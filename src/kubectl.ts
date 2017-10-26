import { Host } from './host';
import { FS } from './fs';
import { Shell, ShellHandler, ShellResult } from './shell';
import * as binutil from './binutil';

export interface Kubectl {
    checkPresent(errorMessageMode : CheckPresentMessageMode) : Promise<boolean>;
    invoke(command : string, handler? : ShellHandler) : Promise<void>;
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

    checkPresent(errorMessageMode : CheckPresentMessageMode) : Promise<boolean> {
        return checkPresent(this.context, errorMessageMode);
    }
    invoke(command : string, handler? : ShellHandler) : Promise<void> {
        return invoke(this.context, command, handler);
    }
    asLines(command : string) : Promise<string[] | ShellResult> {
        return asLines(this.context, command);
    }
    path() : string {
        return path(this.context);
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

async function invokeAsync(context : Context, command : string, handler? : ShellHandler) : Promise<ShellResult> {
    const bin = baseKubectlPath(context);
    let cmd = bin + ' ' + command;
    return await context.shell.exec(cmd);
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
