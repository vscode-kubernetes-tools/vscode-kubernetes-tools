import * as vscode from 'vscode';
import { Host } from '../../host';
import { Shell, Platform } from '../../shell';

const EXTENSION_CONFIG_KEY = "vs-kubernetes";
const KUBECONFIG_PATH_KEY = "vs-kubernetes.kubeconfig";
const KNOWN_KUBECONFIGS_KEY = "vs-kubernetes.knownKubeconfigs";
const KUBECTL_VERSIONING_KEY = "vs-kubernetes.kubectlVersioning";

export enum KubectlVersioning {
    UserProvided = 1,
    Infer = 2,
}

export enum LogsDisplay {
    Webview = 1,
    Terminal = 2,
}

export async function addPathToConfig(configKey: string, value: string): Promise<void> {
    await setConfigValue(configKey, value);
}

async function setConfigValue(configKey: string, value: any): Promise<void> {
    await atAllConfigScopes(addValueToConfigAtScope, configKey, value);
}

async function addValueToConfigAtScope(configKey: string, value: any, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean): Promise<void> {
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
    await vscode.workspace.getConfiguration().update(EXTENSION_CONFIG_KEY, newValue, scope);
}

async function addValueToConfigArray(configKey: string, value: string): Promise<void> {
    await atAllConfigScopes(addValueToConfigArrayAtScope, configKey, value);
}

async function addValueToConfigArrayAtScope(configKey: string, value: string, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean): Promise<void> {
    if (!createIfNotExist) {
        if (!valueAtScope || !(valueAtScope[configKey])) {
            return;
        }
    }

    let newValue: any = {};
    if (valueAtScope) {
        newValue = Object.assign({}, valueAtScope);
    }
    const arrayEntry: string[] = newValue[configKey] || [];
    arrayEntry.push(value);
    newValue[configKey] = arrayEntry;
    await vscode.workspace.getConfiguration().update(EXTENSION_CONFIG_KEY, newValue, scope);
}

type ConfigUpdater<T> = (configKey: string, value: T, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean) => Promise<void>;

async function atAllConfigScopes<T>(fn: ConfigUpdater<T>, configKey: string, value: T): Promise<void> {
    const config = vscode.workspace.getConfiguration().inspect(EXTENSION_CONFIG_KEY)!;
    await fn(configKey, value, vscode.ConfigurationTarget.Global, config.globalValue, true);
    await fn(configKey, value, vscode.ConfigurationTarget.Workspace, config.workspaceValue, false);
    await fn(configKey, value, vscode.ConfigurationTarget.WorkspaceFolder, config.workspaceFolderValue, false);
}

// Functions for working with the list of known kubeconfigs

export function getKnownKubeconfigs(): string[] {
    const kkcConfig = vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)[KNOWN_KUBECONFIGS_KEY];
    if (!kkcConfig || !kkcConfig.length) {
        return [];
    }
    return kkcConfig as string[];
}

export async function addKnownKubeconfig(kubeconfigPath: string) {
    await addValueToConfigArray(KNOWN_KUBECONFIGS_KEY, kubeconfigPath);
}

// Functions for working with the active kubeconfig setting

export async function setActiveKubeconfig(kubeconfig: string): Promise<void> {
    await addPathToConfig(KUBECONFIG_PATH_KEY, kubeconfig);
}

export function getActiveKubeconfig(): string {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)[KUBECONFIG_PATH_KEY];
}

// Functions for working with tool paths

export function getToolPath(host: Host, shell: Shell, tool: string): string | undefined {
    const baseKey = toolPathBaseKey(tool);
    return getPathSetting(host, shell, baseKey);
}

function getPathSetting(host: Host, shell: Shell, baseKey: string): string | undefined {
    const os = shell.platform();
    const osOverridePath = host.getConfiguration(EXTENSION_CONFIG_KEY)[osOverrideKey(os, baseKey)];
    return osOverridePath || host.getConfiguration(EXTENSION_CONFIG_KEY)[baseKey];
}

export function toolPathOSKey(os: Platform, tool: string): string {
    const baseKey = toolPathBaseKey(tool);
    const osSpecificKey = osOverrideKey(os, baseKey);
    return osSpecificKey;
}

function toolPathBaseKey(tool: string): string {
    return `vs-kubernetes.${tool}-path`;
}

function osOverrideKey(os: Platform, baseKey: string): string {
    const osKey = osKeyString(os);
    return osKey ? `${baseKey}.${osKey}` : baseKey;  // The 'else' clause should never happen so don't worry that this would result in double-checking a missing base key
}

function osKeyString(os: Platform): string | null {
    switch (os) {
        case Platform.Windows: return 'windows';
        case Platform.MacOS: return 'mac';
        case Platform.Linux: return 'linux';
        default: return null;
    }
}

export function getKubectlVersioning(): KubectlVersioning {
    const configValue = vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)[KUBECTL_VERSIONING_KEY];
    if (configValue === "infer") {
        return KubectlVersioning.Infer;
    }
    return KubectlVersioning.UserProvided;
}

// Auto cleanup on debug terminate

const AUTO_CLEANUP_DEBUG_KEY = "vs-kubernetes.autoCleanupOnDebugTerminate";

export function getAutoCompleteOnDebugTerminate(): boolean {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)[AUTO_CLEANUP_DEBUG_KEY];
}

export async function setAlwaysCleanUp(): Promise<void> {
    await setConfigValue(AUTO_CLEANUP_DEBUG_KEY, true);
}

// Use WSL on Windows

const USE_WSL_KEY = "use-wsl";

export function getUseWsl(): boolean {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)[USE_WSL_KEY];
}

// minikube check upgrade
const  MK_CHECK_UPGRADE_KEY = 'checkForMinikubeUpgrade';

export function getCheckForMinikubeUpgrade(): boolean {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)[MK_CHECK_UPGRADE_KEY];
}

// Other bits and bobs

export function getOutputFormat(): string {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)['vs-kubernetes.outputFormat'];
}

export function getConfiguredNamespace(): string | undefined {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)['vs-kubernetes.namespace'];
}

export function affectsUs(change: vscode.ConfigurationChangeEvent) {
    return change.affectsConfiguration(EXTENSION_CONFIG_KEY);
}

export function getDisableLint(): boolean {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)['disable-lint'] === 'true';
}

export function getDisabledLinters(): string[] {
    const config = vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY);
    return config['disable-linters'] as string[] || [];
}

export function logsDisplay(): LogsDisplay {
    const config = vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY);
    return (config['logsDisplay'] === 'terminal') ? LogsDisplay.Terminal : LogsDisplay.Webview;
}

// nodejs debugger attach  options

// if true will try to automatically get the root location of the source code in the container
export function getNodejsAutoDetectRemoteRoot(): boolean {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)['vs-kubernetes.nodejs-autodetect-remote-root'];
}
// user specified root location of the source code in the container
export function getNodejsRemoteRoot(): string {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)['vs-kubernetes.nodejs-remote-root'];
}
// remote debugging port for nodejs. Usually 9229
export function getNodejsDebugPort(): number | undefined {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)['vs-kubernetes.nodejs-debug-port'];
}

// container image build tool
const IMAGE_BUILD_TOOL = "imageBuildTool";

export function getImageBuildTool(): string {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)[IMAGE_BUILD_TOOL];
}

// if true will try to automatically get the root location of the source code in the container
export function getPythonAutoDetectRemoteRoot(): boolean {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)['vs-kubernetes.python-autodetect-remote-root'];
}

// user specified root location of the source code in the container
export function getPythonRemoteRoot(): string {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)['vs-kubernetes.python-remote-root'];
}

// remote debugging port for Python. Usually 5678
export function getPythonDebugPort(): number | undefined {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)['vs-kubernetes.python-debug-port'];
}
