import { Terminal } from 'vscode';
import { Host } from './host';
import { FS } from './fs';
import { Shell, ShellHandler, ShellResult } from './shell';
import * as binutil from './binutil';

export interface Kubectl {
    checkPresent(errorMessageMode : CheckPresentMessageMode) : Promise<boolean>;
    invoke(command : string, handler? : ShellHandler) : Promise<void>;
    invokeWithProgress(command : string, progressMessage: string, handler? : ShellHandler) : Promise<void>;
    invokeAsync(command : string) : Promise<ShellResult>;
    invokeAsyncWithProgress(command : string, progressMessage: string) : Promise<ShellResult>;
    /**
     * Invoke a kubectl command in Terminal.
     * @param command the subcommand to run.
     * @param terminalName if empty, run the command in the shared Terminal; otherwise run it in a new Terminal.
     */
    invokeInTerminal(command : string, terminalName? : string) : void;
    asLines(command : string): Promise<string[] | ShellResult>;
    path() : string;
}

interface Context {
    readonly host : Host;
    readonly fs : FS;
    readonly shell : Shell;
    binFound : boolean;
    binPath : string;
}

class KubectlImpl implements Kubectl {
    constructor(host : Host, fs : FS, shell : Shell, kubectlFound : boolean) {
        this.context = { host : host, fs : fs, shell : shell, binFound : kubectlFound, binPath : 'kubectl' };
    }

    private readonly context : Context;
    private sharedTerminal : Terminal;

    checkPresent(errorMessageMode : CheckPresentMessageMode) : Promise<boolean> {
        return checkPresent(this.context, errorMessageMode);
    }
    invoke(command : string, handler? : ShellHandler) : Promise<void> {
        return invoke(this.context, command, handler);
    }
    invokeWithProgress(command : string, progressMessage : string, handler? : ShellHandler) : Promise<void> {
        return invokeWithProgress(this.context, command, progressMessage, handler);
    }
    invokeAsync(command : string) : Promise<ShellResult> {
        return invokeAsync(this.context, command);
    }
    invokeAsyncWithProgress(command : string, progressMessage : string) : Promise<ShellResult> {
        return invokeAsyncWithProgress(this.context, command, progressMessage);
    }
    invokeInTerminal(command : string, terminalName? : string) : void {
        const terminal = terminalName ? this.context.host.createTerminal(terminalName) : this.getSharedTerminal();
        return invokeInTerminal(this.context, command, terminal);
    }
    asLines(command : string) : Promise<string[] | ShellResult> {
        return asLines(this.context, command);
    }
    path() : string {
        return path(this.context);
    }
    private getSharedTerminal() : Terminal {
        if (!this.sharedTerminal) {
            this.sharedTerminal = this.context.host.createTerminal('kubectl');
            const disposable = this.context.host.onDidCloseTerminal((terminal) => {
                if (terminal === this.sharedTerminal) {
                    this.sharedTerminal = null;
                    disposable.dispose();
                }
            });
        }
        return this.sharedTerminal;
    }
}

export function create(host : Host, fs : FS, shell : Shell) : Kubectl {
    return new KubectlImpl(host, fs, shell, false);
}

type CheckPresentMessageMode = 'command' | 'activation';

async function checkPresent(context : Context, errorMessageMode : CheckPresentMessageMode) : Promise<boolean> {
    if (context.binFound) {
        return true;
    }

    return await checkForKubectlInternal(context, errorMessageMode);
}

async function checkForKubectlInternal(context : Context, errorMessageMode : CheckPresentMessageMode) : Promise<boolean> {
    const binName = 'kubectl';
    const bin = context.host.getConfiguration('vs-kubernetes')[`vs-kubernetes.${binName}-path`];

    const contextMessage = getCheckKubectlContextMessage(errorMessageMode);
    const inferFailedMessage = 'Could not find "kubectl" binary.' + contextMessage;
    const configuredFileMissingMessage = bin + ' does not exist!' + contextMessage;

    return await binutil.checkForBinary(context, bin, binName, inferFailedMessage, configuredFileMissingMessage);
}

function getCheckKubectlContextMessage(errorMessageMode : CheckPresentMessageMode) : string {
    if (errorMessageMode === 'activation') {
        return ' Kubernetes commands other than configuration will not function correctly.';
    } else if (errorMessageMode === 'command') {
        return ' Cannot execute command.';
    }
    return '';
}

async function invoke(context : Context, command : string, handler? : ShellHandler) : Promise<void> {
    await kubectlInternal(context, command, handler || kubectlDone(context));
}

async function invokeWithProgress(context : Context, command : string, progressMessage : string, handler? : ShellHandler) : Promise<void> {
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

async function invokeAsync(context : Context, command : string) : Promise<ShellResult> {
    const bin = baseKubectlPath(context);
    let cmd = bin + ' ' + command;
    return await context.shell.exec(cmd);
}

async function invokeAsyncWithProgress(context : Context, command : string, progressMessage : string): Promise<ShellResult> {
    return context.host.withProgress(async (p) => {
        p.report({ message: progressMessage });
        return await invokeAsync(context, command);
    });
}

function invokeInTerminal(context : Context, command : string, terminal : Terminal) : void {
    let bin = baseKubectlPath(context).trim();
    if (bin.indexOf(" ") > -1 && !/^['"]/.test(bin)) {
        bin = `"${bin}"`;
    }
    terminal.sendText(`${bin} ${command}`);
    terminal.show();
}

async function kubectlInternal(context : Context, command : string, handler : ShellHandler) : Promise<void> {
    if (await checkPresent(context, 'command')) {
        const bin = baseKubectlPath(context);
        let cmd = bin + ' ' + command;
        context.shell.exec(cmd).then(({code, stdout, stderr}) => handler(code, stdout, stderr));
    }
}

function kubectlDone(context : Context) : ShellHandler {
    return (result : number, stdout : string, stderr : string) => {
        if (result !== 0) {
            context.host.showErrorMessage('Kubectl command failed: ' + stderr);
            console.log(stderr);
            return;
        }

        context.host.showInformationMessage(stdout);
    };
}

function baseKubectlPath(context : Context) : string {
    let bin = context.host.getConfiguration('vs-kubernetes')['vs-kubernetes.kubectl-path'];
    if (!bin) {
        bin = 'kubectl';
    }
    return bin;
}

async function asLines(context : Context, command : string) : Promise<string[] | ShellResult> {
    const shellResult = await invokeAsync(context, command);
    if (shellResult.code === 0) {
        let lines = shellResult.stdout.split('\n');
        lines.shift();
        lines = lines.filter((l) => l.length > 0);
        return lines;

    }
    return shellResult;
}

function path(context : Context) : string {
    let bin = baseKubectlPath(context);
    return binutil.execPath(context.shell, bin);
}
