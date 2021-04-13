import { Terminal, Disposable } from 'vscode';
import { ChildProcess, spawn as spawnChildProcess } from "child_process";
import { Host, host, LongRunningUIOptions } from './host';
import { FS } from './fs';
import * as fs from 'fs';
import { Shell, ShellResult } from './shell';
import * as binutil from './binutil';
import { Errorable } from './errorable';
import { parseLineOutput } from './outputUtils';
import * as compatibility from './components/kubectl/compatibility';
import { getToolPath, affectsUs, getUseWsl, KubectlVersioning } from './components/config/config';
import { ensureSuitableKubectl } from './components/kubectl/autoversion';
import { invokeForResult, ExternalBinary, FindBinaryStatus, ExecResult, ExecSucceeded, discardFailureInteractive, logText, parseJSON, findBinary, showErrorMessageWithInstallPrompt, parseTable, ExecBinNotFound, invokeTracking, FailedExecResult, ParsedExecResult, parseLinedText, BackgroundExecResult, invokeBackground, RunningProcess } from './binutilplusplus';
import { updateYAMLSchema } from './yaml-support/yaml-schema';
import { Dictionary } from './utils/dictionary';

const KUBECTL_OUTPUT_COLUMN_SEPARATOR = /\s\s+/g;

export interface Kubectl {
    // entangledly shouty but retained for API backcompat
    legacyInvokeAsync(command: string, stdin?: string): Promise<ShellResult | undefined>;
    legacySpawnAsChild(command: string[]): Promise<ChildProcess | undefined>;

    invokeInNewTerminal(command: string, terminalName: string, onClose?: (e: Terminal) => any, pipeTo?: string): Promise<Disposable>;
    invokeInSharedTerminal(command: string): Promise<void>;
    runAsTerminal(command: string[], terminalName: string): Promise<void>;

    // TODO: analyse uses for these and convert these over
    asLines(command: string): Promise<Errorable<string[]>>;
    asJson<T>(command: string): Promise<Errorable<T>>;

    // silent (unless you explicitly ask it to be shouty)
    ensurePresent(options: EnsurePresentOptions): Promise<boolean>;
    invokeCommand(command: string, stdin?: string): Promise<ExecResult>;
    invokeCommandThen<T>(command: string, fn: (execResult: ExecResult) => T): Promise<T>;
    observeCommand(args: string[]): Promise<RunningProcess>;
    spawnCommand(args: string[]): Promise<BackgroundExecResult>;

    // transiently shouty
    invokeCommandWithFeedback(command: string, uiOptions: string | LongRunningUIOptions): Promise<ExecResult>;
    invokeCommandWithFeedbackThen<T>(command: string, uiOptions: string | LongRunningUIOptions, fn: (execResult: ExecResult) => T): Promise<T>;

    // proper shouty
    reportResult(execResult: ExecResult, options: ReportResultOptions): Promise<ExecSucceeded | undefined>;
    reportFailure(execResult: FailedExecResult, options: ReportResultOptions): Promise<void>;
    // consider something of the form: succeedOrNotify(execResult: ExecResult, options: ReportResultOptions): execResult is ExecSucceeded;
    promptInstallDependencies(execResult: ExecBinNotFound, message: string): Promise<void>;
    // checkPossibleIncompatibility(): Promise<void>;

    // TODO: can we get rid of these?
    // silent
    parseJSON<T>(execResult: ExecResult): Errorable<T>;
    parseTable(execResult: ExecResult): Errorable<Dictionary<string>[]>;

    // readXxx = invokeCommand + parseXxx
    // silent
    readJSON<T>(command: string): Promise<ParsedExecResult<T>>;
    readTable(command: string): Promise<ParsedExecResult<Dictionary<string>[]>>;
}

// TODO: move this out of the reporting layer and into the application layer
export interface ReportResultOptions {
    readonly whatFailed?: string;
    readonly updateSchemasOnSuccess?: boolean;
}

export type EnsurePresentOptions = {
    readonly silent?: false;
    readonly warningIfNotPresent: string;
} | {
    readonly silent: true;
};

interface Context {
    readonly host: Host;
    readonly fs: FS;
    readonly shell: Shell;
    readonly pathfinder: (() => Promise<string>) | undefined;
    binFound: boolean;
    binPath: string;
    readonly binary: ExternalBinary;
    status: FindBinaryStatus | undefined;
}

const KUBECTL_BINARY: ExternalBinary = {
    binBaseName: 'kubectl',
    configKeyName: 'kubectl',
    displayName: 'Kubectl',
    offersInstall: true,
};

// TODO: invalidate this when the context changes or if we know kubectl has changed (e.g. config)
let checkedCompatibility = false;  // We don't want to spam the user (or CPU!) repeatedly running the version check

class KubectlImpl implements Kubectl {
    constructor(host: Host, fs: FS, shell: Shell, pathfinder: (() => Promise<string>) | undefined, kubectlFound: false /* TODO: this is now safe to remove */) {
        this.context = {
            host : host,
            fs : fs,
            shell : shell,
            pathfinder: pathfinder,
            binFound : kubectlFound,
            binPath : 'kubectl',
            binary: KUBECTL_BINARY,
            status: undefined
        };
    }

    private readonly context: Context;
    private sharedTerminal: Terminal | null = null;

    checkPresent(errorMessageMode: CheckPresentMessageMode): Promise<boolean> {
        return checkPresent(this.context, errorMessageMode);
    }
    legacyInvokeAsync(command: string, stdin?: string, callback?: (proc: ChildProcess) => void): Promise<ShellResult | undefined> {
        return invokeAsync(this.context, command, stdin, callback);
    }
    legacySpawnAsChild(command: string[]): Promise<ChildProcess | undefined> {
        return spawnAsChild(this.context, command);
    }
    async invokeInNewTerminal(command: string, terminalName: string, onClose?: (e: Terminal) => any, pipeTo?: string): Promise<Disposable> {
        const terminal = this.context.host.createTerminal(terminalName);
        const disposable = onClose ? this.context.host.onDidCloseTerminal(onClose) : new Disposable(() => {});
        await invokeInTerminal(this.context, command, pipeTo, terminal);
        return disposable;
    }
    invokeInSharedTerminal(command: string): Promise<void> {
        const terminal = this.getSharedTerminal();
        return invokeInTerminal(this.context, command, undefined, terminal);
    }
    runAsTerminal(command: string[], terminalName: string): Promise<void> {
        return runAsTerminal(this.context, command, terminalName);
    }
    asLines(command: string): Promise<Errorable<string[]>> {
        return asLines(this.context, command);
    }
    fromLines(command: string): Promise<Errorable<{ [key: string]: string }[]>> {
        return fromLines(this.context, command);
    }
    asJson<T>(command: string): Promise<Errorable<T>> {
        return asJson(this.context, command);
    }
    private getSharedTerminal(): Terminal {
        if (!this.sharedTerminal) {
            this.sharedTerminal = this.context.host.createTerminal('kubectl');
            const disposable = this.context.host.onDidCloseTerminal((terminal) => {
                if (terminal === this.sharedTerminal) {
                    this.sharedTerminal = null;
                    disposable.dispose();
                }
            });
            this.context.host.onDidChangeConfiguration((change) => {
                if (affectsUs(change) && this.sharedTerminal) {
                    this.sharedTerminal.dispose();
                }
            });
        }
        return this.sharedTerminal;
    }

    async checkPossibleIncompatibility(afterError: ExecResult): Promise<void> {
        if (checkedCompatibility) {
            return;
        }
        if (afterError.resultKind === 'exec-bin-not-found') {
            return;
        }

        checkedCompatibility = true;
        const kubectl = this;
        async function kubectlLoadJSON(cmd: string): Promise<Errorable<compatibility.Version>> {
            const json = await kubectl.readJSON<compatibility.Version>(cmd);
            return ExecResult.asErrorable(json, {});
        }
        const compat = await compatibility.check(kubectlLoadJSON);
        if (!compatibility.isGuaranteedCompatible(compat) && compat.didCheck) {
            const versionAlert = `kubectl version ${compat.clientVersion} may be incompatible with cluster Kubernetes version ${compat.serverVersion}`;
            this.context.host.showWarningMessage(versionAlert);
        }
    }

    async ensurePresent(options: EnsurePresentOptions): Promise<boolean> {
        // Do we have a configured location?
        const configuredPath = getToolPath(this.context.host, this.context.shell, this.context.binary.configKeyName);
        if (configuredPath) {
            fs.chmodSync(configuredPath, '0755');
        }

        if (this.context.pathfinder) {
            return true;
        }

        const status = await findBinary(this.context);
        if (status.found) {
            return true;
        }

        if (!options.silent) {
            // TODO: suppressible once refactoring complete!
            showErrorMessageWithInstallPrompt(this.context, status, options.warningIfNotPresent);
        }

        return false;
    }

    async invokeCommand(command: string, stdin?: string): Promise<ExecResult> {
        return await invokeForResult(this.context, command, stdin);
    }

    async invokeCommandThen<T>(command: string, fn: (execResult: ExecResult) => T): Promise<T> {
        const er = await this.invokeCommand(command);
        const result = fn(er);
        return result;
    }

    async observeCommand(args: string[]): Promise<RunningProcess> {
        return await invokeTracking(this.context, args);
    }

    async spawnCommand(args: string[]): Promise<BackgroundExecResult> {
        return await invokeBackground(this.context, args);
    }

    async invokeCommandWithFeedback(command: string, uiOptions: string | LongRunningUIOptions): Promise<ExecResult> {
        return await this.context.host.longRunning(uiOptions, () =>
            this.invokeCommand(command)
        );
    }

    async invokeCommandWithFeedbackThen<T>(command: string, uiOptions: string | LongRunningUIOptions, fn: (execResult: ExecResult) => T): Promise<T> {
        const er = await this.context.host.longRunning(uiOptions, () =>
            this.invokeCommand(command)
        );
        const result = fn(er);
        return result;
    }

    async reportResult(execResult: ExecResult, options: ReportResultOptions): Promise<ExecSucceeded | undefined> {
        const discardFailureOptions = { whatFailed: options.whatFailed };
        const success = await discardFailureInteractive(this.context, execResult, discardFailureOptions);
        if (success) {
            if (options.updateSchemasOnSuccess) {
                updateYAMLSchema();  // TODO: boo - move to higher level
            }
            host.showInformationMessage(success.stdout);
        } else {
            console.log(logText(this.context, execResult));
            this.checkPossibleIncompatibility(execResult);
        }
        return success;
    }

    async reportFailure(execResult: FailedExecResult, options: ReportResultOptions): Promise<void> {
        const discardFailureOptions = { whatFailed: options.whatFailed };
        await discardFailureInteractive(this.context, execResult, discardFailureOptions);
        console.log(logText(this.context, execResult));
        this.checkPossibleIncompatibility(execResult);
    }

    async promptInstallDependencies(execResult: ExecBinNotFound, message: string): Promise<void> {
        await showErrorMessageWithInstallPrompt(this.context, execResult.findResult, message);
    }

    parseJSON<T>(execResult: ExecResult): Errorable<T> {
        return parseJSON<T>(execResult);
    }

    parseTable(execResult: ExecResult): Errorable<Dictionary<string>[]> {
        return parseTable(execResult, KUBECTL_OUTPUT_COLUMN_SEPARATOR);
    }

    async readJSON<T>(command: string): Promise<ParsedExecResult<T>> {
        const er = await this.invokeCommand(command);
        return ExecResult.map(er, (s) => JSON.parse(s) as T);
    }

    async readTable(command: string): Promise<ParsedExecResult<Dictionary<string>[]>> {
        const er = await this.invokeCommand(command);
        return ExecResult.map(er, (s) => parseLinedText(s, KUBECTL_OUTPUT_COLUMN_SEPARATOR));
    }
}

export function create(versioning: KubectlVersioning, host: Host, fs: FS, shell: Shell): Kubectl {
    if (versioning === KubectlVersioning.Infer) {
        return createAutoVersioned(host, fs, shell);
    }
    return createSingleVersion(host, fs, shell);
}

function createSingleVersion(host: Host, fs: FS, shell: Shell): Kubectl {
    return new KubectlImpl(host, fs, shell, undefined, false);
}

function createAutoVersioned(host: Host, fs: FS, shell: Shell): Kubectl {
    const bootstrapper = createSingleVersion(host, fs, shell);
    const pathfinder = async () => (await ensureSuitableKubectl(bootstrapper, shell, host)) || 'kubectl';
    return new KubectlImpl(host, fs, shell, pathfinder, false);
}

export function createOnBinary(host: Host, fs: FS, shell: Shell, bin: string): Kubectl {
    const pathfinder = async () => bin;
    return new KubectlImpl(host, fs, shell, pathfinder, false);
}

export enum CheckPresentMessageMode {
    Command,
    Silent,
}

async function checkPresent(context: Context, errorMessageMode: CheckPresentMessageMode): Promise<boolean> {
    if (context.binFound || context.pathfinder) {
        return true;
    }

    return await checkForKubectlInternal(context, errorMessageMode);
}

async function checkForKubectlInternal(context: Context, errorMessageMode: CheckPresentMessageMode): Promise<boolean> {
    const binName = 'kubectl';
    const bin = getToolPath(context.host, context.shell, binName);

    const contextMessage = getCheckKubectlContextMessage(errorMessageMode);
    const inferFailedMessage = `Could not find "${binName}" binary.${contextMessage}`;
    const configuredFileMissingMessage = `${bin} does not exist! ${contextMessage}`;

    return await binutil.checkForBinary(context, bin, binName, inferFailedMessage, configuredFileMissingMessage, errorMessageMode !== CheckPresentMessageMode.Silent);
}

function getCheckKubectlContextMessage(errorMessageMode: CheckPresentMessageMode): string {
    if (errorMessageMode === CheckPresentMessageMode.Command) {
        return ' Cannot execute command.';
    }
    return '';
}

async function invokeAsync(context: Context, command: string, stdin?: string, callback?: (proc: ChildProcess) => void): Promise<ShellResult | undefined> {
    if (await checkPresent(context, CheckPresentMessageMode.Command)) {
        const bin = await baseKubectlPath(context);
        const cmd = `${bin} ${command}`;
        let sr: ShellResult | undefined;
        if (stdin) {
            sr = await context.shell.exec(cmd, stdin);
        } else {
            sr = await context.shell.execStreaming(cmd, callback);
        }
        if (sr && sr.code !== 0) {
            checkPossibleIncompatibilityLegacy(context);
        }
        return sr;
    } else {
        return { code: -1, stdout: '', stderr: '' };
    }
}

async function checkPossibleIncompatibilityLegacy(context: Context): Promise<void> {
    if (checkedCompatibility) {
        return;
    }
    checkedCompatibility = true;
    const compat = await compatibility.check((cmd) => asJson<compatibility.Version>(context, cmd));
    if (!compatibility.isGuaranteedCompatible(compat) && compat.didCheck) {
        const versionAlert = `kubectl version ${compat.clientVersion} may be incompatible with cluster Kubernetes version ${compat.serverVersion}`;
        context.host.showWarningMessage(versionAlert);
    }
}

async function spawnAsChild(context: Context, command: string[]): Promise<ChildProcess | undefined> {
    if (await checkPresent(context, CheckPresentMessageMode.Command)) {
        return spawnChildProcess(await path(context), command, context.shell.execOpts());
    }
    return undefined;
}

async function invokeInTerminal(context: Context, command: string, pipeTo: string | undefined, terminal: Terminal): Promise<void> {
    if (await checkPresent(context, CheckPresentMessageMode.Command)) {
        // You might be tempted to think we needed to add 'wsl' here if user is using wsl
        // but this runs in the context of a vanilla terminal, which is controlled by the
        // existing preference, so it's not necessary.
        // But a user does need to default VS code to use WSL in the settings.json
        const kubectlCommand = `kubectl ${command}`;
        const fullCommand = pipeTo ? `${kubectlCommand} | ${pipeTo}` : kubectlCommand;
        terminal.sendText(fullCommand);
        terminal.show();
    }
}

async function runAsTerminal(context: Context, command: string[], terminalName: string): Promise<void> {
    if (await checkPresent(context, CheckPresentMessageMode.Command)) {
        let execPath = await path(context);
        const cmd = command;
        if (getUseWsl()) {
            cmd.unshift(execPath);
            // Note VS Code is picky here. It requires the '.exe' to work
            execPath = 'wsl.exe';
        }
        const term = context.host.createTerminal(terminalName, execPath, cmd);
        term.show();
    }
}

async function unquotedBaseKubectlPath(context: Context): Promise<string> {
    if (context.pathfinder) {
        return await context.pathfinder();
    }
    let bin = getToolPath(context.host, context.shell, 'kubectl');
    if (!bin) {
        bin = 'kubectl';
    }
    return bin;
}

async function baseKubectlPath(context: Context): Promise<string> {
    let bin = await unquotedBaseKubectlPath(context);
    if (bin && bin.includes(' ')) {
        bin = `"${bin}"`;
    }
    return bin;
}

async function asLines(context: Context, command: string): Promise<Errorable<string[]>> {
    const shellResult = await invokeAsync(context, command);
    if (!shellResult) {
        return { succeeded: false, error: [`Unable to run command (${command})`] };
    }

    if (shellResult.code === 0) {
        let lines = shellResult.stdout.split('\n');
        lines.shift();
        lines = lines.filter((l) => l.length > 0);
        return { succeeded: true, result: lines };

    }
    return { succeeded: false, error: [ shellResult.stderr ] };
}

async function fromLines(context: Context, command: string): Promise<Errorable<{ [key: string]: string }[]>> {
    const shellResult = await invokeAsync(context, command);
    if (!shellResult) {
        return { succeeded: false, error: [`Unable to run command (${command})`] };
    }

    if (shellResult.code === 0) {
        let lines = shellResult.stdout.split('\n');
        lines = lines.filter((l) => l.length > 0);
        const parsedOutput = parseLineOutput(lines, KUBECTL_OUTPUT_COLUMN_SEPARATOR);
        return { succeeded: true, result: parsedOutput };
    }
    return { succeeded: false, error: [ shellResult.stderr ] };
}

async function asJson<T>(context: Context, command: string): Promise<Errorable<T>> {
    const shellResult = await invokeAsync(context, command);
    if (!shellResult) {
        return { succeeded: false, error: [`Unable to run command (${command})`] };
    }

    if (shellResult.code === 0) {
        return { succeeded: true, result: JSON.parse(shellResult.stdout.trim()) as T };

    }
    return { succeeded: false, error: [ shellResult.stderr ] };
}

async function path(context: Context): Promise<string> {
    const bin = await baseKubectlPath(context);
    return binutil.execPath(context.shell, bin);
}
