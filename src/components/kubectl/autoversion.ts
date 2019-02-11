import * as path from 'path';
import * as sha256 from 'fast-sha256';

import * as download from '../download/download';
import { shell, Shell, Platform } from "../../shell";
import { Dictionary } from '../../utils/dictionary';
import { fs, FS } from '../../fs';
import { Kubectl } from '../../kubectl';
import { getCurrentContext } from '../../kubectlUtils';
import { succeeded } from '../../errorable';

const AUTO_VERSION_CACHE_FILE = getCachePath();

interface ClusterVersionCache {
    readonly derivedFromKubeconfig: string | undefined;
    readonly versions: Dictionary<string>;
}

let AUTO_VERSION_CACHE: ClusterVersionCache | undefined;

export async function ensureSuitableKubectl(kubectl: Kubectl /* TODO: chicken my eggs */, shell: Shell): Promise<string | undefined> {
    const context = await getCurrentContext(kubectl);
    if (!context) {
        return undefined;
    }
    const serverVersion = await getServerVersion(kubectl, context.contextName);
    if (!serverVersion) {
        return undefined;
    }
    if (!(await gotKubectlVersion(shell, serverVersion))) {
        const downloaded = await downloadKubectlVersion(shell, serverVersion);
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
async function downloadKubectlVersion(shell: Shell, serverVersion: string): Promise<boolean> {
    const binPath = kubectlVersionPath(shell, serverVersion);
    if (!binPath) {
        return false;
    }
    const os = platformUrlString(shell.platform())!;
    const binFile = (shell.isUnix()) ? 'kubectl' : 'kubectl.exe';
    const kubectlUrl = `https://storage.googleapis.com/kubernetes-release/release/${serverVersion}/bin/${os}/amd64/${binFile}`;
    const downloadResult = await download.to(kubectlUrl, binPath);
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

async function readCache(): Promise<ClusterVersionCache> {
    if (!AUTO_VERSION_CACHE) {
        AUTO_VERSION_CACHE = await readCacheFromFile();
    }
    if (!isCacheCurrent()) {
        AUTO_VERSION_CACHE = { derivedFromKubeconfig: undefined, versions: {} };
    }
    return AUTO_VERSION_CACHE;
}

async function readCacheFromFile(): Promise<ClusterVersionCache> {
    if (fs.existsAsync(AUTO_VERSION_CACHE_FILE)) {
        return { derivedFromKubeconfig: undefined, versions: {} };
    }
    const cacheText = await fs.readTextFile(AUTO_VERSION_CACHE_FILE);
    return JSON.parse(cacheText);
}

async function writeCache(): Promise<void> {
    if (AUTO_VERSION_CACHE) {
        const text = JSON.stringify(AUTO_VERSION_CACHE, undefined, 2);
        await fs.writeTextFile(AUTO_VERSION_CACHE_FILE, text);
    }
}

async function isCacheCurrent(): Promise<boolean> {
    if (!await fs.existsAsync(KUBECONFIG_FILE)) {
        return false;
    }
    const kubeconfig = await fs.readFileAsync(KUBECONFIG_FILE);
    const kubeconfigHash = sha256.hash(kubeconfig);
    const kubeconfigHashText = hashToString(kubeconfigHash);
    const cacheKubeconfigHashText = AUTO_VERSION_CACHE!.derivedFromKubeconfig;
    return kubeconfigHashText === cacheKubeconfigHashText;
}

function hashToString(hash: Uint8Array): string {
    return Buffer.from(hash).toString('hex');
}

async function getServerVersion(kubectl: Kubectl, context: string): Promise<string | undefined> {
    const cachedVersions = await readCache();
    if (cachedVersions.versions[context]) {
        return cachedVersions.versions[context];
    }
    const sr = await kubectl.invokeAsync('version -o json');
    if (sr && sr.code === 0) {
        const versionInfo = JSON.parse(sr.stdout);
        if (versionInfo && versionInfo.serverVersion) {
            const serverVersion: string = versionInfo.serverVersion.gitVersion;
            cachedVersions.versions[context] = serverVersion;
            await writeCache();
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

class FileBacked<T> {
    private value: T | undefined;

    constructor(
        private readonly fs: FS,
        private readonly filename: string,
        private readonly defaultValue: () => T)
        {}

    async read(): Promise<T> {
        if (this.value) {
            return this.value;
        }
        if (this.fs.existsAsync(this.filename)) {
            const text = await this.fs.readTextFile(this.filename);
            this.value = JSON.parse(text);
            return this.value!;
        }
        await this.update(this.defaultValue());
        return this.value!;
    }

    async update(value: T): Promise<void> {
        this.value = value;
        const text = JSON.stringify(this.value, undefined, 2);
        await this.fs.writeTextFile(this.filename, text);
    }
}
