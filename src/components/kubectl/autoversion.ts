import * as path from 'path';
import * as crypto from 'crypto';

import * as download from '../download/download';
import { Shell, shell } from "../../shell";
import { Dictionary } from '../../utils/dictionary';
import { fs } from '../../fs';
import { Kubectl, createOnBinary as kubectlCreateOnBinary } from '../../kubectl';
import { getCurrentContext } from '../../kubectlUtils';
import { succeeded } from '../../errorable';
import { FileBacked } from '../../utils/filebacked';
import { getKubeconfigPath } from '../kubectl/kubeconfig';
import { getToolPath } from '../config/config';
import { Host } from '../../host';
import { mkdirp } from 'mkdirp';
import { platformUrlString, formatBin, platformArch, vsKubernetesFolder } from '../installer/installationlayout';
import * as installer from '../installer/installer';
import { ExecResult } from '../../binutilplusplus';

const AUTO_VERSION_CACHE_FILE = getCachePath(shell);  // TODO: awkward that we're using a hardwired shell here but parameterising it elsewhere
const AUTO_VERSION_CACHE = new FileBacked<ClusterVersionCache>(fs, AUTO_VERSION_CACHE_FILE, defaultClusterVersionCache);
const OPERATION_ID_DOWNLOAD_KC_FOR_BOOTSTRAP = 'autoversion:download_kubectl_for_bootstrap';

interface ClusterVersionCache {
    readonly derivedFromKubeconfig: string | undefined;
    readonly versions: Dictionary<string>;
}

export async function ensureSuitableKubectl(kubectl: Kubectl, shell: Shell, host: Host): Promise<string | undefined> {
    if (!(await fs.existsAsync(getBasePath(shell)))) {
        await mkdirp(getBasePath(shell));
    }

    const bootstrapperKubectl = await ensureBootstrapperKubectl(kubectl, shell, host);
    if (!bootstrapperKubectl) {
        return undefined;
    }

    const context = await getCurrentContext(bootstrapperKubectl, { silent: true });
    if (!context) {
        return undefined;
    }
    const serverVersion = await getServerVersion(bootstrapperKubectl, context.contextName);
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

function getBasePath(shell: Shell): string {
    return path.join(vsKubernetesFolder(shell), `tools/kubectl/autoversion`);
}

function getCachePath(shell: Shell): string {
    return path.join(getBasePath(shell), `cache.json`);
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
    const arch = platformArch(os);
    const binFile = (shell.isUnix()) ? 'kubectl' : 'kubectl.exe';
    const kubectlUrl = `https://storage.googleapis.com/kubernetes-release/release/${serverVersion}/bin/${os}/${arch}/${binFile}`;
    // TODO: this feels a bit ugly and over-complicated - should perhaps be up to download.once to manage
    // showing the progress UI so we don't need all the operationKey mess
    const downloadResult = await host.longRunning({ title: `Downloading kubectl ${serverVersion}`, operationKey: binPath }, () =>
        download.once(kubectlUrl, binPath)
    );
    if (shell.isUnix()) {
        await fs.chmod(binPath, '0755');
    }
    return succeeded(downloadResult);
}

function kubectlVersionPath(shell: Shell, serverVersion: string): string | undefined {
    const platform = shell.platform();
    const binPath = formatBin('kubectl', platform);
    if (!binPath) {
        return undefined;  // should never happen
    }
    return path.join(getBasePath(shell), serverVersion, binPath);
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
    const kubeconfigPath = getKubeconfigPath();
    const kubeconfigFilePath = kubeconfigPath.pathType === "host" ? kubeconfigPath.hostPath : kubeconfigPath.wslPath;

    // TODO: fs.existsAsync looks in the host filesystem, even in the case of a WSL path. This needs fixing to handle
    // WSL paths properly.
    if (!await fs.existsAsync(kubeconfigFilePath)) {
        return undefined;
    }
    const kubeconfigHashText = crypto.createHash('sha256').update(Buffer.from(kubeconfigFilePath)).digest('hex');
    return kubeconfigHashText;
}

async function getServerVersion(kubectl: Kubectl, context: string): Promise<string | undefined> {
    await ensureCacheIsForCurrentKubeconfig();
    const cachedVersions = await AUTO_VERSION_CACHE.get();
    if (cachedVersions.versions[context]) {
        return cachedVersions.versions[context];
    }
    const versionInfo = await kubectl.readJSON<any>('version -o json');
    if (ExecResult.failed(versionInfo)) {
        return undefined;
    }
    if (versionInfo.result && versionInfo.result.serverVersion) {
        const serverVersion: string = versionInfo.result.serverVersion.gitVersion;
        cachedVersions.versions[context] = serverVersion;
        await AUTO_VERSION_CACHE.update(cachedVersions);
        return serverVersion;
    }
    return undefined;
}

function defaultClusterVersionCache(): ClusterVersionCache {
    return { derivedFromKubeconfig: undefined, versions: {} };
}

async function ensureBootstrapperKubectl(naiveKubectl: Kubectl, shell: Shell, host: Host): Promise<Kubectl | undefined> {
    if (await naiveKubectl.ensurePresent({ silent: true })) {
        return naiveKubectl;
    }

    // There's no kubectl where we were hoping to find one. Is there one in
    // the autoversion directory?
    const existingKubectls = getExistingAutoversionKubectls(shell);
    if (existingKubectls.length > 0) {
        const existingKubectl = existingKubectls[0];
        return kubectlCreateOnBinary(host, fs, shell, existingKubectl);
    }

    // Looks like we're going to have to download one
    const installationResult = await host.longRunning({ title: 'Downloading default version of kubectl', operationKey: OPERATION_ID_DOWNLOAD_KC_FOR_BOOTSTRAP }, () =>
        installer.installKubectl(shell)
    );
    if (!installationResult.succeeded) {
        return undefined;
    }

    const installedToolPath = getToolPath(host, shell, 'kubectl');
    if (!installedToolPath) {
        return undefined;
    }

    return kubectlCreateOnBinary(host, fs, shell, installedToolPath);
}

// TODO: would be nice to make this async
function getExistingAutoversionKubectls(shell: Shell): string[] {
    const baseFolder = getBasePath(shell);
    const downloadedFolders = fs.dirSync(baseFolder)
                                .map((p) => path.join(baseFolder, p))
                                .filter((p) => fs.statSync(p).isDirectory);
    const binName = formatBin('kubectl', shell.platform());
    if (!binName) {
        return [];
    }
    const kubectls = downloadedFolders.map((f) => path.join(f, binName)).filter((p) => fs.existsSync(p));
    return kubectls;

}
