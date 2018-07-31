'use strict';

import * as vscode from 'vscode';
import { Shell, ShellResult } from '../../../shell';
import { Host } from '../../../host';
import { FS } from '../../../fs';
import * as binutil from '../../../binutil';
import { Errorable } from '../../../errorable';
import { fromShellExitCodeOnly, Diagnostic } from '../../../wizard';

export class MinikubeOptions {
    readonly vmDriver: string;
    readonly additionalFlags: string;
}

export interface Minikube {
    checkPresent(mode: CheckPresentMode): Promise<boolean>;
    isRunnable(): Promise<Errorable<Diagnostic>>;
    start(options: MinikubeOptions): Promise<void>;
    stop(): Promise<void>;
}

export function create(host: Host, fs: FS, shell: Shell, installDependenciesCallback: () => void): Minikube {
    return new MinikubeImpl(host, fs, shell, installDependenciesCallback, false);
}

// TODO: these are the same as we are using for Draft (and kubectl?) -
// we really need to unify them (and the designs).

export enum CheckPresentMode {
    Alert,
    Silent
}

interface Context {
    readonly host: Host;
    readonly fs: FS;
    readonly shell: Shell;
    readonly installDependenciesCallback: () => void;
    binFound: boolean;
    binPath: string;
}

class MinikubeImpl implements Minikube {
    private readonly context: Context;

    constructor(host: Host, fs: FS, shell: Shell, installDependenciesCallback: () => void, toolFound: boolean) {
        this.context = { host : host, fs : fs, shell : shell, installDependenciesCallback : installDependenciesCallback, binFound : toolFound, binPath : 'minikube' };
    }

    checkPresent(mode: CheckPresentMode): Promise<boolean> {
        return checkPresent(this.context, mode);
    }

    isRunnable(): Promise<Errorable<Diagnostic>> {
        return isRunnableMinikube(this.context);
    }

    start(options: MinikubeOptions): Promise<void> {
        return startMinikube(this.context, options);
    }

    stop(): Promise<void> {
        return stopMinikube(this.context);
    }
}

async function isRunnableMinikube(context: Context): Promise<Errorable<Diagnostic>> {
    if (!await checkPresent(context, CheckPresentMode.Alert)) {
        return { succeeded: false, error: [ 'Minikube is not installed '] };
    }

    const sr = await context.shell.exec(`${context.binPath} help`);
    return fromShellExitCodeOnly(sr);
}

async function startMinikube(context: Context, options: MinikubeOptions): Promise<void> {
    if (!await checkPresent(context, CheckPresentMode.Alert)) {
        return;
    }
    let flags = options.additionalFlags ? options.additionalFlags : '';
    if (options.vmDriver && options.vmDriver.length > 0) {
        flags += ` --vm-driver=${options.vmDriver} `;
    }
    context.shell.exec(`${context.binPath} ${flags} start`).then((result: ShellResult) => {
        if (result.code === 0) {
            vscode.window.showInformationMessage('Cluster started.');
        } else {
            vscode.window.showErrorMessage(`Failed to start cluster ${result.stderr}`);
        }
    }).catch((err) => {
        vscode.window.showErrorMessage(`Failed to start cluster: ${err}`);
    });
}

async function stopMinikube(context: Context): Promise<void> {
    if (!await checkPresent(context, CheckPresentMode.Alert)) {
        return;
    }

    context.shell.exec(`${context.binPath} stop`).then((result: ShellResult) => {
        if (result.code === 0) {
            vscode.window.showInformationMessage('Cluster stopped.');
        } else {
            vscode.window.showErrorMessage(`Error stopping cluster ${result.stderr}`);
        }
    }).catch((err) => {
        vscode.window.showErrorMessage(`Error stopping cluster: ${err}`);
    });
}

async function checkPresent(context: Context, mode: CheckPresentMode): Promise<boolean> {
    if (context.binFound) {
        return true;
    }

    return await checkForMinikubeInternal(context, mode);
}

async function checkForMinikubeInternal(context: Context, mode: CheckPresentMode): Promise<boolean> {
    const binName = 'minikube';
    const bin = context.host.getConfiguration('vs-kubernetes')[`vs-kubernetes.${binName}-path`];

    const inferFailedMessage = 'Could not find "minikube" binary.';
    const configuredFileMissingMessage = bin + ' does not exist!';
    return binutil.checkForBinary(context, bin, binName, inferFailedMessage, configuredFileMissingMessage, mode === CheckPresentMode.Alert);
}
