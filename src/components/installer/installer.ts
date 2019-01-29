'use strict';

import * as download from '../download/download';
import * as fs from 'fs';
import mkdirp = require('mkdirp');
import * as path from 'path';
import * as tar from 'tar';
import { Shell, Platform } from '../../shell';
import { Errorable, failed } from '../../errorable';
import { addPathToConfig, toolPathBaseKey, getUseWsl } from '../config/config';

export async function installKubectl(shell: Shell): Promise<Errorable<null>> {
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
    const downloadResult = await download.to(kubectlUrl, downloadFile);
    if (failed(downloadResult)) {
        return { succeeded: false, error: [`Failed to download kubectl: ${downloadResult.error[0]}`] };
    }

    if (shell.isUnix()) {
        fs.chmodSync(downloadFile, '0777');
    }

    await addPathToConfig(toolPathBaseKey(tool), downloadFile);
    return { succeeded: true, result: null };
}

async function getStableMinikubeVersion(): Promise<Errorable<string>> {
    const downloadResult = await download.toTempFile('https://api.github.com/repos/kubernetes/minikube/releases/latest');
    if (failed(downloadResult)) {
        return { succeeded: false, error: [`Failed to find minikube stable version: ${downloadResult.error[0]}`]};
    }
    const versionObj = JSON.parse(fs.readFileSync(downloadResult.result, 'utf-8'));
    fs.unlinkSync(downloadResult.result);
    return { succeeded: true, result: versionObj['tag_name'] };
}

async function getStableKubectlVersion(): Promise<Errorable<string>> {
    const downloadResult = await download.toTempFile('https://storage.googleapis.com/kubernetes-release/release/stable.txt');
    if (failed(downloadResult)) {
        return { succeeded: false, error: [`Failed to establish kubectl stable version: ${downloadResult.error[0]}`] };
    }
    const version = fs.readFileSync(downloadResult.result, 'utf-8');
    fs.unlinkSync(downloadResult.result);
    return { succeeded: true, result: version };
}

export async function installHelm(shell: Shell): Promise<Errorable<null>> {
    const tool = 'helm';
    const urlTemplate = 'https://storage.googleapis.com/kubernetes-helm/helm-v2.9.1-{os_placeholder}-amd64.tar.gz';
    return await installToolFromTar(tool, urlTemplate, shell);
}

export async function installDraft(shell: Shell): Promise<Errorable<null>> {
    const tool = 'draft';
    const urlTemplate = 'https://azuredraft.blob.core.windows.net/draft/draft-v0.15.0-{os_placeholder}-amd64.tar.gz';
    return await installToolFromTar(tool, urlTemplate, shell);
}

export async function installMinikube(shell: Shell, version: string | null): Promise<Errorable<null>> {
    const tool = 'minikube';
    const os = platformUrlString(shell.platform());
    if (!os) {
        return { succeeded: false, error: ['Not supported on this OS'] };
    }
    if (!version) {
        const versionRes = await getStableMinikubeVersion();
        if (failed(versionRes)) {
            return { succeeded: false, error: versionRes.error };
        }
        version = versionRes.result;
    }
    const exe = (shell.isWindows() ? '.exe' : '');
    const urlTemplate = `https://storage.googleapis.com/minikube/releases/${version}/minikube-{os_placeholder}-amd64${exe}`;
    const url = urlTemplate.replace('{os_placeholder}', os);
    const installFolder = getInstallFolder(shell, tool);
    const executable = formatBin(tool, shell.platform())!;  // safe because we checked platform earlier
    const executableFullPath = path.join(installFolder, executable);
    const downloadResult = await download.to(url, executableFullPath);
    if (failed(downloadResult)) {
        return { succeeded: false, error: ['Failed to download Minikube: error was ' + downloadResult.error[0]] };
    }

    if (shell.isUnix()) {
        await shell.exec(`chmod +x ${executableFullPath}`);
    }
    const configKey = toolPathBaseKey(tool);
    await addPathToConfig(configKey, executableFullPath);

    return { succeeded: true, result: null };
}

async function installToolFromTar(tool: string, urlTemplate: string, shell: Shell, supported?: Platform[]): Promise<Errorable<null>> {
    const os = platformUrlString(shell.platform(), supported);
    if (!os) {
        return { succeeded: false, error: ['Not supported on this OS'] };
    }
    const installFolder = getInstallFolder(shell, tool);
    const executable = formatBin(tool, shell.platform())!;  // safe because we have already checked the platform
    const url = urlTemplate.replace('{os_placeholder}', os);
    const configKey = toolPathBaseKey(tool);
    return installFromTar(url, installFolder, executable, configKey, shell);
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

async function installFromTar(sourceUrl: string, destinationFolder: string, executablePath: string, configKey: string, shell: Shell): Promise<Errorable<null>> {
    // download it
    const downloadResult = await download.toTempFile(sourceUrl);

    if (failed(downloadResult)) {
        return { succeeded: false, error: ['Failed to download: error was ' + downloadResult.error[0]] };
    }

    const tarfile = downloadResult.result;

    // untar it
    const untarResult = await untar(tarfile, destinationFolder, shell);
    if (failed(untarResult)) {
        return { succeeded: false, error: ['Failed to unpack: error was ' + untarResult.error[0]] };
    }

    // add path to config
    let executableFullPath = path.join(destinationFolder, executablePath);
    if (getUseWsl()) {
        executableFullPath = executableFullPath.replace(/\\/g, '/');
    }
    await addPathToConfig(configKey, executableFullPath);

    await fs.unlink(tarfile);

    return { succeeded: true, result: null };
}

async function untar(sourceFile: string, destinationFolder: string, shell: Shell): Promise<Errorable<null>> {
    try {
        if (getUseWsl()) {
            const destination = destinationFolder.replace(/\\/g, '/');
            let result = await shell.exec(`mkdir -p ${destination}`);
            if (result.code !== 0) {
                console.log(result.stderr);
                throw new Error(`Error making directory: ${result.stderr}`);
            }
            const drive = sourceFile[0].toLowerCase();
            const filePath = sourceFile.substring(2).replace(/\\/g, '/');
            const fileName = `/mnt/${drive}/${filePath}`;
            const cmd = `tar -C ${destination} -xf ${fileName}`;
            result = await shell.exec(cmd);
            if (result.code !== 0) {
                console.log(result.stderr);
                throw new Error(`Error unpacking: ${result.stderr}`);
            }
            return { succeeded: true, result: null };
        }
        if (!fs.existsSync(destinationFolder)) {
            mkdirp.sync(destinationFolder);
        }
        await tar.x({
            cwd: destinationFolder,
            file: sourceFile
        });
        return { succeeded: true, result: null };
    } catch (e) {
        console.log(e);
        return { succeeded: false, error: [ "tar extract failed" ] /* TODO: extract error from exception */ };
    }
}
