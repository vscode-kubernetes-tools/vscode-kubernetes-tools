import { Terminal, Disposable } from 'vscode';
import { ChildProcess, spawn as spawnChildProcess } from "child_process";
import { Host } from './host';
import { FS } from './fs';
import { Shell, ShellHandler, ShellResult } from './shell';
import * as binutil from './binutil';
import { Errorable } from './errorable';

export interface Kubectl {
    checkPresent(errorMessageMode: CheckPresentMessageMode): Promise<boolean>;
    invoke(command: string, handler?: ShellHandler): Promise<void>;
    invokeWithProgress(command: string, progressMessage: string, handler?: ShellHandler): Promise<void>;
    invokeAsync(command: string, stdin?: string): Promise<ShellResult>;
    invokeAsyncWithProgress(command: string, progressMessage: string): Promise<ShellResult>;
    spawnAsChild(command: string[]): Promise<ChildProcess>;
    /**
     * Invoke a kubectl command in Terminal.
     * @param command the subcommand to run.
     * @param terminalName if empty, run the command in the shared Terminal; otherwise run it in a new Terminal.
     */
    invokeInNewTerminal(command: string, terminalName: string, onClose?: (e: Terminal) => any, pipeTo?: string): Promise<Disposable>;
    invokeInSharedTerminal(command: string): Promise<void>;
    runAsTerminal(command: string[], terminalName: string): Promise<void>;
    asLines(command: string): Promise<Errorable<string[]>>;
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
    private sharedTerminal: Terminal;

    checkPresent(errorMessageMode: CheckPresentMessageMode): Promise<boolean> {
        return checkPresent(this.context, errorMessageMode);
    }
    invoke(command: string, handler?: ShellHandler): Promise<void> {
        return invoke(this.context, command, handler);
    }
    invokeWithProgress(command: string, progressMessage: string, handler?: ShellHandler): Promise<void> {
        return invokeWithProgress(this.context, command, progressMessage, handler);
    }
    invokeAsync(command: string, stdin?: string): Promise<ShellResult> {
        return invokeAsync(this.context, command, stdin);
    }
    invokeAsyncWithProgress(command: string, progressMessage: string): Promise<ShellResult> {
        return invokeAsyncWithProgress(this.context, command, progressMessage);
    }
    spawnAsChild(command: string[]): Promise<ChildProcess> {
        return spawnAsChild(this.context, command);
    }
    async invokeInNewTerminal(command: string, terminalName: string, onClose?: (e: Terminal) => any, pipeTo?: string): Promise<Disposable> {
        const terminal = this.context.host.createTerminal(terminalName);
        const disposable = onClose ? this.context.host.onDidCloseTerminal(onClose) : null;
        await invokeInTerminal(this.context, command, pipeTo, terminal);
        return disposable;
    }
    invokeInSharedTerminal(command: string, terminalName?: string): Promise<void> {
        const terminal = this.getSharedTerminal();
        return invokeInTerminal(this.context, command, undefined, terminal);
    }
    runAsTerminal(command: string[], terminalName: string): Promise<void> {
        return runAsTerminal(this.context, command, terminalName);
    }
    asLines(command: string): Promise<Errorable<string[]>> {
        return asLines(this.context, command);
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
                if (change.affectsConfiguration('vs-kubernetes') && this.sharedTerminal) {
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

type CheckPresentMessageMode = 'command' | 'activation' | 'silent';

async function checkPresent(context: Context, errorMessageMode: CheckPresentMessageMode): Promise<boolean> {
    if (context.binFound) {
        return true;
    }

    return await checkForKubectlInternal(context, errorMessageMode);
}

async function checkForKubectlInternal(context: Context, errorMessageMode: CheckPresentMessageMode): Promise<boolean> {
    const binName = 'kubectl';
    const bin = context.host.getConfiguration('vs-kubernetes')[`vs-kubernetes.${binName}-path`];

    const contextMessage = getCheckKubectlContextMessage(errorMessageMode);
    const inferFailedMessage = 'Could not find "kubectl" binary.' + contextMessage;
    const configuredFileMissingMessage = `${bin} does not exist! ${contextMessage}`;

    return await binutil.checkForBinary(context, bin, binName, inferFailedMessage, configuredFileMissingMessage, errorMessageMode !== 'silent');
}

function getCheckKubectlContextMessage(errorMessageMode: CheckPresentMessageMode): string {
    if (errorMessageMode === 'activation') {
        return ' Kubernetes commands other than configuration will not function correctly.';
    } else if (errorMessageMode === 'command') {
        return ' Cannot execute command.';
    }
    return '';
}

async function invoke(context: Context, command: string, handler?: ShellHandler): Promise<void> {
    await kubectlInternal(context, command, handler || kubectlDone(context));
}

async function invokeWithProgress(context: Context, command: string, progressMessage: string, handler?: ShellHandler): Promise<void> {
    return context.host.withProgress((p) => {
        return new Promise<void>((resolve, reject) => {
            p.report({ message: progressMessage });
            kubectlInternal(context, command, (code, stdout, stderr) => {
                resolve();
                (handler || kubectlDone(context))(code, stdout, stderr);
            });
        });
    });
}

async function invokeAsync(context: Context, command: string, stdin?: string): Promise<ShellResult> {
    if (await checkPresent(context, 'command')) {
        const bin = baseKubectlPath(context);
        const cmd = `${bin} ${command}`;
        return await context.shell.exec(cmd, stdin);
    } else {
        return { code: -1, stdout: '', stderr: '' };
    }
}

async function invokeAsyncWithProgress(context: Context, command: string, progressMessage: string): Promise<ShellResult> {
    return context.host.withProgress(async (p) => {
        p.report({ message: progressMessage });
        return await invokeAsync(context, command);
    });
}

async function spawnAsChild(context: Context, command: string[]): Promise<ChildProcess> {
    if (await checkPresent(context, 'command')) {
        return spawnChildProcess(path(context), command, context.shell.execOpts());
    }
}

async function invokeInTerminal(context: Context, command: string, pipeTo: string | undefined, terminal: Terminal): Promise<void> {
    if (await checkPresent(context, 'command')) {
        const kubectlCommand = `kubectl ${command}`;
        const fullCommand = pipeTo ? `${kubectlCommand} | ${pipeTo}` : kubectlCommand;
        terminal.sendText(fullCommand);
        terminal.show();
    }
}

async function runAsTerminal(context: Context, command: string[], terminalName: string): Promise<void> {
    if (await checkPresent(context, 'command')) {
        const term = context.host.createTerminal(terminalName, path(context), command);
        term.show();
    }
}

async function kubectlInternal(context: Context, command: string, handler: ShellHandler): Promise<void> {
    if (await checkPresent(context, 'command')) {
        const bin = baseKubectlPath(context);
        const cmd = `${bin} ${command}`;
        context.shell.exec(cmd, null).then(({code, stdout, stderr}) => handler(code, stdout, stderr));
    }
}

function kubectlDone(context: Context): ShellHandler {
    return (result: number, stdout: string, stderr: string) => {
        if (result !== 0) {
            context.host.showErrorMessage('Kubectl command failed: ' + stderr);
            console.log(stderr);
            return;
        }

        context.host.showInformationMessage(stdout);
    };
}

function baseKubectlPath(context: Context): string {
    let bin = context.host.getConfiguration('vs-kubernetes')['vs-kubernetes.kubectl-path'];
    if (!bin) {
        bin = 'kubectl';
    }
    return bin;
}

async function asLines(context: Context, command: string): Promise<Errorable<string[]>> {
    const shellResult = await invokeAsync(context, command);
    if (shellResult.code === 0) {
        let lines = shellResult.stdout.split('\n');
        lines.shift();
        lines = lines.filter((l) => l.length > 0);
        return { succeeded: true, result: lines };

    }
    return { succeeded: false, error: [ shellResult.stderr ] };
}

async function asJson<T>(context: Context, command: string): Promise<Errorable<T>> {
    const shellResult = await invokeAsync(context, command);
    if (shellResult.code === 0) {
        return { succeeded: true, result: JSON.parse(shellResult.stdout.trim()) as T };

    }
    return { succeeded: false, error: [ shellResult.stderr ] };
}

function path(context: Context): string {
    const bin = baseKubectlPath(context);
    return binutil.execPath(context.shell, bin);
}
