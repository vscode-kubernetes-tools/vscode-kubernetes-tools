import { Terminal, Disposable, ThemeIcon } from 'vscode';
import type { ChildProcess } from "./process";
import { Host, host, LongRunningUIOptions } from './host';
import { FS } from './fs';
import { Shell } from './shell';
import * as binutil from './binutil';
import { Errorable } from './errorable';
import { parseLineOutput } from './outputUtils';
import * as compatibility from './components/kubectl/compatibility';
import { getToolPath, getUseWsl, KubectlVersioning, suppressKubectlNotFound } from './components/config/config';
import { ensureSuitableKubectl } from './components/kubectl/autoversion';
import { invokeForResult, ExternalBinary, FindBinaryStatus, ExecResult, ExecSucceeded, discardFailureInteractive, logText, parseJSON, findBinary, showErrorMessageWithInstallPrompt, parseTable, ExecBinNotFound, invokeTracking, FailedExecResult, ParsedExecResult, parseLinedText, BackgroundExecResult, invokeBackground, RunningProcess } from './binutilplusplus';
import { updateYAMLSchema } from './yaml-support/yaml-schema';
import { Dictionary } from './utils/dictionary';

const KUBECTL_OUTPUT_COLUMN_SEPARATOR = /\s\s+/g;

export interface Kubectl {
    invokeInNewTerminal(args: readonly string[], terminalName: string, onClose?: (e: Terminal) => any, iconPath?: ThemeIcon): Promise<Disposable>;
    invokeInSharedTerminal(args: readonly string[]): Promise<void>;
    runAsTerminal(args: readonly string[], terminalName: string): Promise<void>;

    // TODO: analyse uses for these and convert these over
    asLines(args: readonly string[]): Promise<Errorable<string[]>>;
    asJson<T>(args: readonly string[]): Promise<Errorable<T>>;

    // silent (unless you explicitly ask it to be shouty)
    ensurePresent(options: EnsurePresentOptions): Promise<boolean>;
    invokeCommand(args: readonly string[], stdin?: string): Promise<ExecResult>;
    invokeCommandThen<T>(args: readonly string[], fn: (execResult: ExecResult) => T): Promise<T>;
    observeCommand(args: readonly string[]): Promise<RunningProcess>;
    spawnCommand(args: readonly string[]): Promise<BackgroundExecResult>;

    // transiently shouty
    invokeCommandWithFeedback(args: readonly string[], uiOptions: string | LongRunningUIOptions): Promise<ExecResult>;
    invokeCommandWithFeedbackThen<T>(args: readonly string[], uiOptions: string | LongRunningUIOptions, fn: (execResult: ExecResult) => T): Promise<T>;

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
    readJSON<T>(args: readonly string[]): Promise<ParsedExecResult<T>>;
    readTable(args: readonly string[]): Promise<ParsedExecResult<Dictionary<string>[]>>;

    dispose(): void;
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
    private childProcesses: ChildProcess[] = [];

    checkPresent(errorMessageMode: CheckPresentMessageMode): Promise<boolean> {
        return checkPresent(this.context, errorMessageMode);
    }
    async invokeInNewTerminal(args: readonly string[], terminalName: string, onClose?: (e: Terminal) => any, iconPath?: ThemeIcon): Promise<Disposable> {
        const terminal = await runAsTerminal(this.context, args, terminalName, iconPath);
        if (!terminal) {
            return new Disposable(() => {});
        }
        const disposable = this.context.host.onDidCloseTerminal((closedTerminal) => {
            if (closedTerminal === terminal) {
                onClose?.(closedTerminal);
                disposable.dispose();
            }
        });
        return disposable;
    }
    async invokeInSharedTerminal(args: readonly string[]): Promise<void> {
        await runAsTerminal(this.context, args, 'kubectl');
    }
    async runAsTerminal(args: readonly string[], terminalName: string): Promise<void> {
        await runAsTerminal(this.context, args, terminalName);
    }
    asLines(args: readonly string[]): Promise<Errorable<string[]>> {
        return asLines(this.context, args);
    }
    fromLines(args: readonly string[]): Promise<Errorable<{ [key: string]: string }[]>> {
        return fromLines(this.context, args);
    }
    asJson<T>(args: readonly string[]): Promise<Errorable<T>> {
        return asJson(this.context, args);
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
        async function kubectlLoadJSON(args: readonly string[]): Promise<Errorable<compatibility.Version>> {
            const json = await kubectl.readJSON<compatibility.Version>(args);
            return ExecResult.asErrorable(json, {});
        }
        const compat = await compatibility.check(kubectlLoadJSON);
        if (!compatibility.isGuaranteedCompatible(compat) && compat.didCheck) {
            const versionAlert = `kubectl version ${compat.clientVersion} may be incompatible with cluster Kubernetes version ${compat.serverVersion}`;
            this.context.host.showWarningMessage(versionAlert);
        }
    }

    async ensurePresent(options: EnsurePresentOptions): Promise<boolean> {
        if (this.context.pathfinder) {
            return true;
        }

        const status = await findBinary(this.context);
        if (status.found) {
            return true;
        }

        if (!options.silent && !suppressKubectlNotFound()) {
            showErrorMessageWithInstallPrompt(this.context, status, options.warningIfNotPresent);
        }

        return false;
    }

    async invokeCommand(args: readonly string[], stdin?: string): Promise<ExecResult> {
        return await invokeForResult(this.context, args, stdin);
    }

    async invokeCommandThen<T>(args: readonly string[], fn: (execResult: ExecResult) => T): Promise<T> {
        const er = await this.invokeCommand(args);
        const result = fn(er);
        return result;
    }

    async observeCommand(args: readonly string[]): Promise<RunningProcess> {
        return await invokeTracking(this.context, args);
    }

    async spawnCommand(args: readonly string[]): Promise<BackgroundExecResult> {
        const execResult = await invokeBackground(this.context, args);
        if (execResult.resultKind === 'exec-child-process-started') {
            this.childProcesses.push(execResult.childProcess);
        }
        return execResult;
    }

    async invokeCommandWithFeedback(args: readonly string[], uiOptions: string | LongRunningUIOptions): Promise<ExecResult> {
        return await this.context.host.longRunning(uiOptions, () =>
            this.invokeCommand(args)
        );
    }

    async invokeCommandWithFeedbackThen<T>(args: readonly string[], uiOptions: string | LongRunningUIOptions, fn: (execResult: ExecResult) => T): Promise<T> {
        const er = await this.context.host.longRunning(uiOptions, () =>
            this.invokeCommand(args)
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
        const allowInteractive = !(execResult.resultKind === 'exec-bin-not-found' && suppressKubectlNotFound());
        if (allowInteractive) {
            await discardFailureInteractive(this.context, execResult, discardFailureOptions);
        }
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

    async readJSON<T>(args: readonly string[]): Promise<ParsedExecResult<T>> {
        const er = await this.invokeCommand(args);
        return ExecResult.map(er, (s) => JSON.parse(s) as T);
    }

    async readTable(args: readonly string[]): Promise<ParsedExecResult<Dictionary<string>[]>> {
        const er = await this.invokeCommand(args);
        return ExecResult.map(er, (s) => parseLinedText(s, KUBECTL_OUTPUT_COLUMN_SEPARATOR));
    }

    dispose() {
        this.childProcesses.forEach((child) => {
            if (!child.killed) {
                child.kill();
            }
        });
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

async function runAsTerminal(context: Context, command: readonly string[], terminalName: string, iconPath?: ThemeIcon): Promise<Terminal | undefined> {
    if (await checkPresent(context, CheckPresentMessageMode.Command)) {
        let execPath = await path(context);
        let cmd = [...command];
        if (getUseWsl()) {
            cmd = ['--exec', execPath, ...cmd];
            // Note VS Code is picky here. It requires the '.exe' to work
            execPath = 'wsl.exe';
        }
        const term = context.host.createTerminal(terminalName, execPath, cmd, iconPath);
        term.show();
        return term;
    }
    return undefined;
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

async function asLines(context: Context, args: readonly string[]): Promise<Errorable<string[]>> {
    const result = await invokeForResult(context, args, undefined);
    if (ExecResult.succeeded(result)) {
        let lines = result.stdout.split('\n');
        lines.shift();
        lines = lines.filter((l) => l.length > 0);
        return { succeeded: true, result: lines };
    }
    return { succeeded: false, error: [ExecResult.failureMessage(result, {})] };
}

async function fromLines(context: Context, args: readonly string[]): Promise<Errorable<{ [key: string]: string }[]>> {
    const result = await invokeForResult(context, args, undefined);
    if (ExecResult.succeeded(result)) {
        let lines = result.stdout.split('\n');
        lines = lines.filter((l) => l.length > 0);
        const parsedOutput = parseLineOutput(lines, KUBECTL_OUTPUT_COLUMN_SEPARATOR);
        return { succeeded: true, result: parsedOutput };
    }
    return { succeeded: false, error: [ExecResult.failureMessage(result, {})] };
}

async function asJson<T>(context: Context, args: readonly string[]): Promise<Errorable<T>> {
    const result = await invokeForResult(context, args, undefined);
    if (ExecResult.succeeded(result)) {
        return { succeeded: true, result: JSON.parse(result.stdout.trim()) as T };
    }
    return { succeeded: false, error: [ExecResult.failureMessage(result, {})] };
}

async function path(context: Context): Promise<string> {
    const bin = context.pathfinder ? await context.pathfinder() : (context.binFound ? context.binPath : await unquotedBaseKubectlPath(context));
    return binutil.execPath(context.shell, bin);
}
