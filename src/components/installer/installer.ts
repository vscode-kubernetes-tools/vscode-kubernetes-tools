'use strict';

import * as https from 'https';
import * as download from '../download/download';
import * as fs from 'fs';
import mkdirp = require('mkdirp');
import * as path from 'path';
import * as unzipper from 'unzipper';
import * as tar from 'tar';
import { Shell, Platform } from '../../shell';
import { Errorable, failed, succeeded } from '../../errorable';
import { addPathToConfig, toolPathOSKey, getUseWsl } from '../config/config';
import { platformUrlString, formatBin, platformArch } from './installationlayout';
import { IncomingMessage } from 'http';

enum ArchiveKind {
    Tar,
    Zip,
}

export async function installKubectl(shell: Shell): Promise<Errorable<null>> {
    const tool = 'kubectl';
    const binFile = (shell.isUnix()) ? 'kubectl' : 'kubectl.exe';
    const platform = shell.platform();
    const os = platformUrlString(platform);
    if (!os) {
        return { succeeded: false, error: ['Not supported on this OS'] };
    }
    const arch = platformArch(os);

    const version = await getStableKubectlVersion();
    if (failed(version)) {
        return { succeeded: false, error: version.error };
    }

    const installFolder = getInstallFolder(shell, tool);
    mkdirp.sync(installFolder);

    const kubectlUrl = `https://storage.googleapis.com/kubernetes-release/release/${version.result.trim()}/bin/${os}/${arch}/${binFile}`;
    const downloadFile = path.join(installFolder, binFile);
    const downloadResult = await download.to(kubectlUrl, downloadFile);
    if (failed(downloadResult)) {
        return { succeeded: false, error: [`Failed to download kubectl: ${downloadResult.error[0]}`] };
    }

    if (shell.isUnix()) {
        fs.chmodSync(downloadFile, '0755');
    }

    await addPathToConfig(toolPathOSKey(platform, tool), downloadFile);
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

async function getStableHelmVersion(): Promise<Errorable<string>> {
    return new Promise<Errorable<string>>((resolve, _reject) => {
        try {
            const request = https.get('https://github.com/helm/helm/releases/latest', (r: IncomingMessage) => {
                const location = r.headers.location;
                if (location) {
                    const locationBits = location.split('/');
                    const version = locationBits[locationBits.length - 1];
                    resolve({ succeeded: true, result: version });
                } else {
                    resolve({ succeeded: false, error: ['No location in response']});
                }
            });
            request.on('error', (err) => resolve({ succeeded: false, error: [`${err}`]}));
        }
        catch (err) {
            resolve({ succeeded: false, error: [`${err}`]});
        }
    });
}

const DEFAULT_HELM_VERSION = 'v3.0.0';

export async function installHelm(shell: Shell, warn: (message: string) => void): Promise<Errorable<null>> {
    const tool = 'helm';
    const latestVersionInfo = await getStableHelmVersion();
    if (failed(latestVersionInfo)) {
        warn(`Couldn't identify latest stable Helm: defaulting to ${DEFAULT_HELM_VERSION}. Error info: ${latestVersionInfo.error[0]}`);
    }
    const latestVersion = succeeded(latestVersionInfo) ? latestVersionInfo.result : DEFAULT_HELM_VERSION;
    const fileExtension = shell.isWindows() ? 'zip' : 'tar.gz';
    const archiveKind = shell.isWindows() ? ArchiveKind.Zip : ArchiveKind.Tar;
    const urlTemplate = `https://get.helm.sh/helm-${latestVersion}-{os_placeholder}-{arch}.${fileExtension}`;
    return await installToolFromArchive(tool, urlTemplate, shell, archiveKind);
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
    const arch = platformArch(os);
    const exe = (shell.isWindows() ? '.exe' : '');
    const url = `https://storage.googleapis.com/minikube/releases/${version}/minikube-${os}-${arch}${exe}`;
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
    const configKey = toolPathOSKey(shell.platform(), tool);
    await addPathToConfig(configKey, executableFullPath);

    return { succeeded: true, result: null };
}

async function installToolFromArchive(tool: string, urlTemplate: string, shell: Shell, archiveKind: ArchiveKind, supported?: Platform[]): Promise<Errorable<null>> {
    const os = platformUrlString(shell.platform(), supported);
    if (!os) {
        return { succeeded: false, error: ['Not supported on this OS'] };
    }
    const arch = platformArch(os);
    const installFolder = getInstallFolder(shell, tool);
    const executable = formatBin(tool, shell.platform())!;  // safe because we have already checked the platform
    const url = urlTemplate.replace('{os_placeholder}', os).replace('{arch}', arch);
    const configKey = toolPathOSKey(shell.platform(), tool);
    return installFromArchive(url, installFolder, executable, configKey, shell, archiveKind);
}

function getInstallFolder(shell: Shell, tool: string): string {
    return path.join(shell.home(), `.vs-kubernetes/tools/${tool}`);
}

async function installFromArchive(sourceUrl: string, destinationFolder: string, executablePath: string, configKey: string, shell: Shell, archiveKind: ArchiveKind): Promise<Errorable<null>> {
    // download it
    const downloadResult = await download.toTempFile(sourceUrl);

    if (failed(downloadResult)) {
        return { succeeded: false, error: ['Failed to download: error was ' + downloadResult.error[0]] };
    }

    const archiveFile = downloadResult.result;

    // unarchive it
    const unarchiveResult = await unarchive(archiveFile, destinationFolder, shell, archiveKind);
    if (failed(unarchiveResult)) {
        return { succeeded: false, error: ['Failed to unpack: error was ' + unarchiveResult.error[0]] };
    }

    // add path to config
    let executableFullPath = path.join(destinationFolder, executablePath);
    if (getUseWsl()) {
        executableFullPath = executableFullPath.replace(/\\/g, '/');
    }
    await addPathToConfig(configKey, executableFullPath);

    fs.unlinkSync(archiveFile);

    return { succeeded: true, result: null };
}

async function unarchive(sourceFile: string, destinationFolder: string, shell: Shell, archiveKind: ArchiveKind): Promise<Errorable<null>> {
    if (archiveKind === ArchiveKind.Tar) {
        return await untar(sourceFile, destinationFolder, shell);
    } else {
        return await unzip(sourceFile, destinationFolder);
    }
}

function unzip(sourceFile: string, destinationFolder: string): Promise<Errorable<null>> {
    return new Promise<Errorable<null>>((resolve, _reject) => {
        const stream = fs.createReadStream(sourceFile)
                         .pipe(unzipper.Extract({ path: destinationFolder }));
        stream.on('close', () => resolve({ succeeded: true, result: null }));
        stream.on('error', (err) => resolve({ succeeded: false, error: [`zip extract failed: ${err}`] }));
    });
}

async function untar(sourceFile: string, destinationFolder: string, shell: Shell): Promise<Errorable<null>> {
    try {
        if (getUseWsl()) {
            const destination = destinationFolder.replace(/\\/g, '/');
            let result = await shell.exec(`mkdir -p ${destination}`);
            if (!result || result.code !== 0) {
                const message = result ? result.stderr : "Unable to run mkdir";
                console.log(message);
                throw new Error(`Error making directory: ${message}`);
            }
            const drive = sourceFile[0].toLowerCase();
            const filePath = sourceFile.substring(2).replace(/\\/g, '/');
            const fileName = `/mnt/${drive}/${filePath}`;
            const cmd = `tar -C ${destination} -xf ${fileName}`;
            result = await shell.exec(cmd);
            if (!result || result.code !== 0) {
                const message = result ? result.stderr : "Unable to run tar";
                console.log(message);
                throw new Error(`Error unpacking: ${message}`);
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
