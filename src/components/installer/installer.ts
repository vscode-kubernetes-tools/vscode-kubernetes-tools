'use strict';

import * as download from 'download';
import * as fs from 'fs';
import mkdirp = require('mkdirp');
import * as path from 'path';
import * as tar from 'tar';
import * as tmp from 'tmp';
import * as vscode from 'vscode';
import { Shell, Platform } from '../../shell';
import { Errorable, failed, succeeded } from '../../errorable';

export async function installKubectl(shell: Shell): Promise<Errorable<void>> {
    const tool = 'kubectl';
    const binFile = (shell.isUnix()) ? 'kubectl' : 'kubectl.exe';
    const os = platformUrlString(shell.platform());

    const version = await getStableKubectlVersion();
    if (failed(version)) {
        return { succeeded: false, error: version.error };
    }

    const installFolder = getInstallFolder(shell, tool);
    mkdirp.sync(installFolder);

    const kubectlUrl = `https://storage.googleapis.com/kubernetes-release/release/${version.result.trim()}/bin/${os}/amd64/${binFile}`;
    const downloadFile = path.join(installFolder, binFile);
    const downloadResult = await downloadTo(kubectlUrl, downloadFile);
    if (failed(downloadResult)) {
        return { succeeded: false, error: [`Failed to download kubectl: ${downloadResult.error[0]}`] };
    }

    if (shell.isUnix()) {
        fs.chmodSync(downloadFile, '0777');
    }

    await addPathToConfig(`vs-kubernetes.${tool}-path`, downloadFile);
    return { succeeded: true, result: null };
}

async function getStableKubectlVersion(): Promise<Errorable<string>> {
    const downloadResult = await downloadToTempFile('https://storage.googleapis.com/kubernetes-release/release/stable.txt');
    if (failed(downloadResult)) {
        return { succeeded: false, error: [`Failed to establish kubectl stable version: ${downloadResult.error[0]}`] };
    }
    const version = fs.readFileSync(downloadResult.result, 'utf-8');
    fs.unlinkSync(downloadResult.result);
    return { succeeded: true, result: version };
}

export async function installHelm(shell: Shell): Promise<Errorable<void>> {
    const tool = 'helm';
    const urlTemplate = 'https://storage.googleapis.com/kubernetes-helm/helm-v2.8.2-{os_placeholder}-amd64.tar.gz';
    return await installToolFromTar(tool, urlTemplate, shell);
}

export async function installDraft(shell: Shell): Promise<Errorable<void>> {
    const tool = 'draft';
    const urlTemplate = 'https://azuredraft.blob.core.windows.net/draft/draft-v0.14.1-{os_placeholder}-amd64.tar.gz';
    return await installToolFromTar(tool, urlTemplate, shell);
}

async function installToolFromTar(tool: string, urlTemplate: string, shell: Shell, supported?: Platform[]): Promise<Errorable<void>> {
    const os = platformUrlString(shell.platform(), supported);
    if (!os) {
        return { succeeded: false, error: ['Not supported on this OS'] };
    }
    const installFolder = getInstallFolder(shell, tool);
    const executable = formatBin(tool, shell.platform());
    const url = urlTemplate.replace('{os_placeholder}', os);
    const configKey = `vs-kubernetes.${tool}-path`;
    return installFromTar(url, installFolder, executable, configKey);
}

function getInstallFolder(shell: Shell, tool: string): string {
    return path.join(shell.home(), `.vs-kubernetes/tools/${tool}`);
}

function platformUrlString(platform: Platform, supported?: Platform[]): string | null {
    if (supported && supported.indexOf(platform) < 0) {
        return null;
    }
    switch (platform) {
        case Platform.Windows: return 'windows';
        case Platform.MacOS: return 'darwin';
        case Platform.Linux: return 'linux';
        default: return null;
    }
}

function formatBin(tool: string, platform: Platform): string | null {
    const platformString = platformUrlString(platform);
    if (!platformString) {
        return null;
    }
    const toolPath = `${platformString}-amd64/${tool}`;
    if (platform === Platform.Windows) {
        return toolPath + '.exe';
    }
    return toolPath;
}

async function installFromTar(sourceUrl: string, destinationFolder: string, executablePath: string, configKey: string): Promise<Errorable<void>> {
    // download it
    const downloadResult = await downloadToTempFile(sourceUrl);

    if (failed(downloadResult)) {
        return { succeeded: false, error: ['Failed to download Helm: error was ' + downloadResult.error[0]] };
    }

    const tarfile = downloadResult.result;

    // untar it
    const untarResult = await untar(tarfile, destinationFolder);
    if (failed(untarResult)) {
        return { succeeded: false, error: ['Failed to unpack Helm: error was ' + untarResult.error[0]] };
    }

    // add path to config
    const executableFullPath = path.join(destinationFolder, executablePath);
    await addPathToConfig(configKey, executableFullPath);

    await fs.unlink(tarfile);

    return { succeeded: true, result: null };
}

async function downloadToTempFile(sourceUrl: string): Promise<Errorable<string>> {
    const tempFileObj = tmp.fileSync({ prefix: "vsk-autoinstall-" });
    const downloadResult = await downloadTo(sourceUrl, tempFileObj.name);
    if (succeeded(downloadResult)) {
        return { succeeded: true, result: tempFileObj.name };
    }
    return { succeeded: false, error: downloadResult.error };
}

async function downloadTo(sourceUrl: string, destinationFile: string): Promise<Errorable<void>> {
    try {
        await download(sourceUrl, path.dirname(destinationFile), { filename: path.basename(destinationFile) });
        return { succeeded: true, result: null };
    } catch (e) {
        return { succeeded: false, error: [e.message] };
    }
}

async function untar(sourceFile: string, destinationFolder: string): Promise<Errorable<void>> {
    try {
        if (!fs.existsSync(destinationFolder)) {
            mkdirp.sync(destinationFolder);
        }
        await tar.x({
            cwd: destinationFolder,
            file: sourceFile
        });
        return { succeeded: true, result: null };
    } catch (e) {
        return { succeeded: false, error: [ "tar extract failed" ] /* TODO: extract error from exception */ };
    }
}

async function addPathToConfig(configKey: string, executableFullPath: string): Promise<void> {
    const config = vscode.workspace.getConfiguration().inspect("vs-kubernetes");
    await addPathToConfigAtScope(configKey, executableFullPath, vscode.ConfigurationTarget.Global, config.globalValue, true);
    await addPathToConfigAtScope(configKey, executableFullPath, vscode.ConfigurationTarget.Workspace, config.workspaceValue, false);
    await addPathToConfigAtScope(configKey, executableFullPath, vscode.ConfigurationTarget.WorkspaceFolder, config.workspaceFolderValue, false);
}

async function addPathToConfigAtScope(configKey: string, value: string, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean): Promise<void> {
    if (!createIfNotExist) {
        if (!valueAtScope || !(valueAtScope[configKey])) {
            return;
        }
    }

    let newValue: any = {};
    if (valueAtScope) {
        newValue = Object.assign({}, valueAtScope);
    }
    newValue[configKey] = value;
    await vscode.workspace.getConfiguration().update("vs-kubernetes", newValue, scope);
}
