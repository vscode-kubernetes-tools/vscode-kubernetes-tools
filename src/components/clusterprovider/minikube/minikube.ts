'use strict';

import * as vscode from 'vscode';
import { Shell } from '../../../shell';
import { Host } from '../../../host';
import { FS } from '../../../fs';
import * as binutil from '../../../binutil';
import { Errorable, failed } from '../../../errorable';
import { fromShellExitCodeOnly, Diagnostic } from '../../../wizard';
import { getToolPath, getCheckForMinikubeUpgrade } from '../../config/config';
import { installMinikube } from '../../installer/installer';

export class MinikubeInfo {
    readonly running: boolean;
    readonly message: string;
}

export class MinikubeVersionInfo {
    readonly currentVersion: string;
    readonly availableVersion: string;
}

export class MinikubeOptions {
    readonly vmDriver: string;
    readonly additionalFlags: string;
}

export interface Minikube {
    checkPresent(mode: CheckPresentMode): Promise<boolean>;
    checkUpgradeAvailable(): Promise<void>;
    isRunnable(): Promise<Errorable<Diagnostic>>;
    start(options: MinikubeOptions): Promise<void>;
    stop(): Promise<void>;
    status(): Promise<MinikubeInfo>;
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
        this.context = { host: host, fs: fs, shell: shell, installDependenciesCallback: installDependenciesCallback, binFound: toolFound, binPath: 'minikube' };
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

    status(): Promise<MinikubeInfo> {
        return minikubeStatus(this.context);
    }

    checkUpgradeAvailable() {
        return minikubeUpgradeAvailable(this.context);
    }
}

async function getVersionInfo(context: Context): Promise<MinikubeVersionInfo> {
    const sr = await context.shell.exec(`"${context.binPath}" update-check`);
    if (!sr || sr.code !== 0) {
        throw new Error(`Error checking for minikube updates: ${sr ? sr.stderr : 'cannot run minikube'}`);
    }
    const lines = sr.stdout.split('\n')
                           .map((l) => l.trim())
                           .filter((l) => l.length > 0);
    if (lines.length !== 2) {
        throw new Error(`Unexpected output for minikube version check: ${lines}`);
    }

    const currentVersion = extractVersion(lines[0]);
    const availableVersion = extractVersion(lines[1]);

    if (currentVersion === null || availableVersion === null) {
        throw new Error(`Unable to get version from minikube version check: ${lines}`);
    }

    return {
        currentVersion: currentVersion,
        availableVersion: availableVersion
    } as MinikubeVersionInfo;
}

async function minikubeUpgradeAvailable(context: Context): Promise<void> {

    const performUpgradeCheck = await checkPresent(context, CheckPresentMode.Silent) && getCheckForMinikubeUpgrade();
    if (!performUpgradeCheck) {
        return;
    }

    let versionInfo: MinikubeVersionInfo;

    try {
        versionInfo = await getVersionInfo(context);
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to determine minikube version: ${err}`);
        return;
    }

    if (versionInfo.currentVersion !== versionInfo.availableVersion) {
        const value = await vscode.window.showInformationMessage(`Minikube upgrade available to ${versionInfo.availableVersion}, currently on ${versionInfo.currentVersion}`, 'Install');
        if (value === 'Install') {
            const result = await installMinikube(context.shell, versionInfo.availableVersion);
            if (failed(result)) {
                vscode.window.showErrorMessage(`Failed to update minikube: ${result.error}`);
            }
        }
    }
}

function extractVersion(line: string): string {
    const parts = line.split(': ');
    return parts[1];
}

async function isRunnableMinikube(context: Context): Promise<Errorable<Diagnostic>> {
    if (!await checkPresent(context, CheckPresentMode.Alert)) {
        return { succeeded: false, error: ['Minikube is not installed'] };
    }

    const sr = await context.shell.exec(`"${context.binPath}" help`);
    return fromShellExitCodeOnly(sr, "Unable to run Minikube");
}

let minikubeStatusBarItem: vscode.StatusBarItem | undefined;

function getStatusBar(): vscode.StatusBarItem {
    if (!minikubeStatusBarItem) {
        minikubeStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    }
    return minikubeStatusBarItem;
}

async function startMinikube(context: Context, options: MinikubeOptions): Promise<void> {
    if (!await checkPresent(context, CheckPresentMode.Alert)) {
        return;
    }
    const item = getStatusBar();
    item.text = 'minikube-starting';
    item.show();

    const status = await minikubeStatus(context);
    if (status.running) {
        vscode.window.showWarningMessage('Minikube cluster is already started.');
        return;
    }

    let flags = options.additionalFlags ? options.additionalFlags : '';
    if (options.vmDriver && options.vmDriver.length > 0) {
        flags += ` --vm-driver=${options.vmDriver} `;
    }
    context.shell.exec(`"${context.binPath}" ${flags} start`).then((result) => {
        if (result && result.code === 0) {
            vscode.window.showInformationMessage('Cluster started.');
            item.text = 'minikube-running';
        } else {
            vscode.window.showErrorMessage(`Failed to start cluster ${result ? result.stderr : "Unable to run Minikube"}`);
            item.hide();
        }
    }).catch((err) => {
        item.hide();
        vscode.window.showErrorMessage(`Failed to start cluster: ${err}`);
    });
}

async function stopMinikube(context: Context): Promise<void> {
    if (!await checkPresent(context, CheckPresentMode.Alert)) {
        return;
    }
    const item = getStatusBar();
    item.text = 'minikube-stopping';
    item.show();

    const status = await minikubeStatus(context);
    if (!status.running) {
        vscode.window.showWarningMessage('Minikube cluster is already stopped.');
        return;
    }

    context.shell.exec(`"${context.binPath}" stop`).then((result) => {
        if (result && result.code === 0) {
            vscode.window.showInformationMessage('Cluster stopped.');
            item.hide();
        } else {
            vscode.window.showErrorMessage(`Error stopping cluster ${result ? result.stderr : "Unable to run Minikube"}`);
            item.hide();
        }
    }).catch((err) => {
        vscode.window.showErrorMessage(`Error stopping cluster: ${err}`);
        item.hide();
    });
}

async function minikubeStatus(context: Context): Promise<MinikubeInfo> {
    if (!await checkPresent(context, CheckPresentMode.Silent)) {
        throw new Error('Minikube executable could not be found!');
    }

    const result = await context.shell.exec(`"${context.binPath}" status`);

    if (result && result.stderr.length === 0) {
        const hostStatus = result.stdout.split('\n')[0].split(': ')[1].toLowerCase();
        return {
            running: 'stopped' !== hostStatus,
            message: `${result.stdout}`

        } as MinikubeInfo;
    }
    throw new Error(`Failed to get status: ${result ? result.stderr : "Unable to run Minikube"}`);
}

async function checkPresent(context: Context, mode: CheckPresentMode): Promise<boolean> {
    if (context.binFound) {
        return true;
    }

    return await checkForMinikubeInternal(context, mode);
}

async function checkForMinikubeInternal(context: Context, mode: CheckPresentMode): Promise<boolean> {
    const binName = 'minikube';
    const bin = getToolPath(context.host, context.shell, binName);

    const inferFailedMessage = `Could not find "${binName}" binary.`;
    const configuredFileMissingMessage = `${bin} does not exist!`;
    return binutil.checkForBinary(context, bin, binName, inferFailedMessage, configuredFileMissingMessage, mode === CheckPresentMode.Alert);
}
