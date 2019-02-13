import * as path from 'path';
import * as sha256 from 'fast-sha256';

import * as download from '../download/download';
import { shell, Shell, Platform } from "../../shell";
import { Dictionary } from '../../utils/dictionary';
import { fs } from '../../fs';
import { Kubectl } from '../../kubectl';
import { getCurrentContext } from '../../kubectlUtils';
import { succeeded } from '../../errorable';
import { FileBacked } from '../../utils/filebacked';
import { getActiveKubeconfig } from '../config/config';
import { Host } from '../../host';
import { mkdirpAsync } from '../../utils/mkdirp';

const AUTO_VERSION_CACHE_FILE = getCachePath();
const AUTO_VERSION_CACHE = new FileBacked<ClusterVersionCache>(fs, AUTO_VERSION_CACHE_FILE, defaultClusterVersionCache);

interface ClusterVersionCache {
    readonly derivedFromKubeconfig: string | undefined;
    readonly versions: Dictionary<string>;
}

export async function ensureSuitableKubectl(kubectl: Kubectl, shell: Shell, host: Host): Promise<string | undefined> {
    if (!(await fs.existsAsync(getBasePath()))) {
        await mkdirpAsync(getBasePath());
    }
    const context = await getCurrentContext(kubectl);
    if (!context) {
        return undefined;
    }
    const serverVersion = await getServerVersion(kubectl, context.contextName);
    if (!serverVersion) {
        return undefined;
    }
    if (!(await gotKubectlVersion(shell, serverVersion))) {
        const downloaded = await downloadKubectlVersion(shell, host, serverVersion);
        if (!downloaded) {
            return undefined;
        }
    }
    return kubectlVersionPath(shell, serverVersion);
}

function getBasePath(): string {
    return path.join(shell.home(), `.vs-kubernetes/tools/kubectl/autoversion`);
}

function getCachePath(): string {
    return path.join(getBasePath(), `cache.json`);
}

async function gotKubectlVersion(shell: Shell, serverVersion: string): Promise<boolean> {
    const binPath = kubectlVersionPath(shell, serverVersion);
    if (!binPath) {
        return true;  // if we can't place the binary, there's no point downloading it
    }
    return await fs.existsAsync(binPath);
}

// TODO: deduplicate with installer.ts
async function downloadKubectlVersion(shell: Shell, host: Host, serverVersion: string): Promise<boolean> {
    const binPath = kubectlVersionPath(shell, serverVersion);
    if (!binPath) {
        return false;
    }
    const os = platformUrlString(shell.platform())!;
    const binFile = (shell.isUnix()) ? 'kubectl' : 'kubectl.exe';
    const kubectlUrl = `https://storage.googleapis.com/kubernetes-release/release/${serverVersion}/bin/${os}/amd64/${binFile}`;
    // TODO: this feels a bit ugly and over-complicated - should perhaps be up to download.once to manage
    // showing the progress UI so we don't need all the operationKey mess
    const downloadResult = await host.longRunning({ title: `Downloading kubectl ${serverVersion}`, operationKey: binPath }, () =>
        download.once(kubectlUrl, binPath)
    );
    return succeeded(downloadResult);
}

function kubectlVersionPath(shell: Shell, serverVersion: string): string | undefined {
    const platform = shell.platform();
    const binPath = formatBin('kubectl', platform);
    if (!binPath) {
        return undefined;  // should never happen
    }
    return path.join(getBasePath(), serverVersion, binPath);
}

async function ensureCacheIsForCurrentKubeconfig(): Promise<void> {
    const kubeconfigHashText = await getKubeconfigPathHash();
    if (!kubeconfigHashText) {
        AUTO_VERSION_CACHE.update({ derivedFromKubeconfig: undefined, versions: {} });
        return;
    }
    const cacheKubeconfigHashText = (await AUTO_VERSION_CACHE.get()).derivedFromKubeconfig;
    if (kubeconfigHashText !== cacheKubeconfigHashText) {
        AUTO_VERSION_CACHE.update({ derivedFromKubeconfig: kubeconfigHashText, versions: {} });
    }
}

async function getKubeconfigPathHash(): Promise<string | undefined> {
    const kubeconfigPath = getActiveKubeconfig() || process.env['KUBECONFIG'] || path.join(shell.home(), '.kube/config');
    if (!await fs.existsAsync(kubeconfigPath)) {
        return undefined;
    }
    const kubeconfigPathHash = sha256.hash(Buffer.from(kubeconfigPath));
    const kubeconfigHashText = hashToString(kubeconfigPathHash);
    return kubeconfigHashText;
}

function hashToString(hash: Uint8Array): string {
    return Buffer.from(hash).toString('hex');
}

async function getServerVersion(kubectl: Kubectl, context: string): Promise<string | undefined> {
    await ensureCacheIsForCurrentKubeconfig();
    const cachedVersions = await AUTO_VERSION_CACHE.get();
    if (cachedVersions.versions[context]) {
        return cachedVersions.versions[context];
    }
    const sr = await kubectl.invokeAsync('version -o json');
    if (sr && sr.code === 0) {
        const versionInfo = JSON.parse(sr.stdout);
        if (versionInfo && versionInfo.serverVersion) {
            const serverVersion: string = versionInfo.serverVersion.gitVersion;
            cachedVersions.versions[context] = serverVersion;
            await AUTO_VERSION_CACHE.update(cachedVersions);
            return serverVersion;
        }
    }
    return undefined;
}

// TODO: deduplicate from installer.ts
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

function defaultClusterVersionCache(): ClusterVersionCache {
    return { derivedFromKubeconfig: undefined, versions: {} };
}
