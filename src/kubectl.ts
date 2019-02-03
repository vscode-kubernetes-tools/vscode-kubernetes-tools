import { Terminal, Disposable } from 'vscode';
import { ChildProcess, spawn as spawnChildProcess } from "child_process";
import { Host } from './host';
import { FS } from './fs';
import { Shell, ShellHandler, ShellResult } from './shell';
import * as binutil from './binutil';
import { Errorable } from './errorable';
import { parseLineOutput } from './outputUtils';
import * as compatibility from './components/kubectl/compatibility';
import { getToolPath, affectsUs, getUseWsl } from './components/config/config';

const KUBECTL_OUTPUT_COLUMN_SEPARATOR = /\s+/g;

export interface Kubectl {
    checkPresent(errorMessageMode: CheckPresentMessageMode): Promise<boolean>;
    invoke(command: string, handler?: ShellHandler): Promise<void>;
    invokeWithProgress(command: string, progressMessage: string, handler?: ShellHandler): Promise<void>;
    invokeAsync(command: string, stdin?: string): Promise<ShellResult | undefined>;
    invokeAsyncWithProgress(command: string, progressMessage: string): Promise<ShellResult | undefined>;
    spawnAsChild(command: string[]): Promise<ChildProcess | undefined>;
    /**
     * Invoke a kubectl command in Terminal.
     * @param command the subcommand to run.
     * @param terminalName if empty, run the command in the shared Terminal; otherwise run it in a new Terminal.
     */
    invokeInNewTerminal(command: string, terminalName: string, onClose?: (e: Terminal) => any, pipeTo?: string): Promise<Disposable>;
    invokeInSharedTerminal(command: string): Promise<void>;
    runAsTerminal(command: string[], terminalName: string): Promise<void>;
    asLines(command: string): Promise<Errorable<string[]>>;
    fromLines(command: string): Promise<Errorable<{ [key: string]: string }[]>>;
    asJson<T>(command: string): Promise<Errorable<T>>;
}

interface Context {
    readonly host: Host;
    readonly fs: FS;
    readonly shell: Shell;
    readonly installDependenciesCallback: () => void;
    binFound: boolean;
    binPath: string;
}

class KubectlImpl implements Kubectl {
    constructor(host: Host, fs: FS, shell: Shell, installDependenciesCallback: () => void, kubectlFound: boolean) {
        this.context = { host : host, fs : fs, shell : shell, installDependenciesCallback : installDependenciesCallback, binFound : kubectlFound, binPath : 'kubectl' };
    }

    private readonly context: Context;
    private sharedTerminal: Terminal | null = null;

    checkPresent(errorMessageMode: CheckPresentMessageMode): Promise<boolean> {
        return checkPresent(this.context, errorMessageMode);
    }
    invoke(command: string, handler?: ShellHandler): Promise<void> {
        return invoke(this.context, command, handler);
    }
    invokeWithProgress(command: string, progressMessage: string, handler?: ShellHandler): Promise<void> {
        return invokeWithProgress(this.context, command, progressMessage, handler);
    }
    invokeAsync(command: string, stdin?: string): Promise<ShellResult | undefined> {
        return invokeAsync(this.context, command, stdin);
    }
    invokeAsyncWithProgress(command: string, progressMessage: string): Promise<ShellResult | undefined> {
        return invokeAsyncWithProgress(this.context, command, progressMessage);
    }
    spawnAsChild(command: string[]): Promise<ChildProcess | undefined> {
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
}

export function create(host: Host, fs: FS, shell: Shell, installDependenciesCallback: () => void): Kubectl {
    return new KubectlImpl(host, fs, shell, installDependenciesCallback, false);
}

export enum CheckPresentMessageMode {
    Command,
    Activation,
    Silent,
}

async function checkPresent(context: Context, errorMessageMode: CheckPresentMessageMode): Promise<boolean> {
    if (context.binFound) {
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
    if (errorMessageMode === CheckPresentMessageMode.Activation) {
        return ' Kubernetes commands other than configuration will not function correctly.';
    } else if (errorMessageMode === CheckPresentMessageMode.Command) {
        return ' Cannot execute command.';
    }
    return '';
}

async function invoke(context: Context, command: string, handler?: ShellHandler): Promise<void> {
    await kubectlInternal(context, command, handler || kubectlDone(context));
}

async function invokeWithProgress(context: Context, command: string, progressMessage: string, handler?: ShellHandler): Promise<void> {
    return context.host.withProgress((p) => {
        return new Promise<void>((resolve) => {
            p.report({ message: progressMessage });
            kubectlInternal(context, command, (code, stdout, stderr) => {
                resolve();
                (handler || kubectlDone(context))(code, stdout, stderr);
            });
        });
    });
}

async function invokeAsync(context: Context, command: string, stdin?: string): Promise<ShellResult | undefined> {
    if (await checkPresent(context, CheckPresentMessageMode.Command)) {
        const bin = baseKubectlPath(context);
        const cmd = `${bin} ${command}`;
        const sr = await context.shell.exec(cmd, stdin);
        if (sr && sr.code !== 0) {
            checkPossibleIncompatibility(context);
        }
        return sr;
    } else {
        return { code: -1, stdout: '', stderr: '' };
    }
}

// TODO: invalidate this when the context changes or if we know kubectl has changed (e.g. config)
let checkedCompatibility = false;  // We don't want to spam the user (or CPU!) repeatedly running the version check

async function checkPossibleIncompatibility(context: Context): Promise<void> {
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

async function invokeAsyncWithProgress(context: Context, command: string, progressMessage: string): Promise<ShellResult | undefined> {
    return context.host.withProgress(async (p) => {
        p.report({ message: progressMessage });
        return await invokeAsync(context, command);
    });
}

async function spawnAsChild(context: Context, command: string[]): Promise<ChildProcess | undefined> {
    if (await checkPresent(context, CheckPresentMessageMode.Command)) {
        return spawnChildProcess(path(context), command, context.shell.execOpts());
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
        let execPath = path(context);
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

async function kubectlInternal(context: Context, command: string, handler: ShellHandler): Promise<void> {
    if (await checkPresent(context, CheckPresentMessageMode.Command)) {
        const bin = baseKubectlPath(context);
        const cmd = `${bin} ${command}`;
        const sr = await context.shell.exec(cmd);
        if (sr) {
            handler(sr.code, sr.stdout, sr.stderr);
        }
    }
}

function kubectlDone(context: Context): ShellHandler {
    return (result: number, stdout: string, stderr: string) => {
        if (result !== 0) {
            context.host.showErrorMessage('Kubectl command failed: ' + stderr);
            console.log(stderr);
            checkPossibleIncompatibility(context);
            return;
        }

        context.host.showInformationMessage(stdout);
    };
}

function baseKubectlPath(context: Context): string {
    let bin = getToolPath(context.host, context.shell, 'kubectl');
    if (!bin) {
        bin = 'kubectl';
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

function path(context: Context): string {
    const bin = baseKubectlPath(context);
    return binutil.execPath(context.shell, bin);
}
