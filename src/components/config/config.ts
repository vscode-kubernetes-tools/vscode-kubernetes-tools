import * as vscode from 'vscode';
import { Host } from '../../host';

const EXTENSION_CONFIG_KEY = "vs-kubernetes";
const KUBECONFIG_PATH_KEY = "vs-kubernetes.kubeconfig";
const KNOWN_KUBECONFIGS_KEY = "vs-kubernetes.knownKubeconfigs";

export async function addPathToConfig(configKey: string, value: string): Promise<void> {
    const config = vscode.workspace.getConfiguration().inspect(EXTENSION_CONFIG_KEY);
    await addPathToConfigAtScope(configKey, value, vscode.ConfigurationTarget.Global, config.globalValue, true);
    await addPathToConfigAtScope(configKey, value, vscode.ConfigurationTarget.Workspace, config.workspaceValue, false);
    await addPathToConfigAtScope(configKey, value, vscode.ConfigurationTarget.WorkspaceFolder, config.workspaceFolderValue, false);
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
    await vscode.workspace.getConfiguration().update(EXTENSION_CONFIG_KEY, newValue, scope);
}

async function addValueToConfigArray(configKey: string, value: string): Promise<void> {
    const config = vscode.workspace.getConfiguration().inspect(EXTENSION_CONFIG_KEY);
    await addValueToConfigArrayAtScope(configKey, value, vscode.ConfigurationTarget.Global, config.globalValue, true);
    await addValueToConfigArrayAtScope(configKey, value, vscode.ConfigurationTarget.Workspace, config.workspaceValue, false);
    await addValueToConfigArrayAtScope(configKey, value, vscode.ConfigurationTarget.WorkspaceFolder, config.workspaceFolderValue, false);
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

export function getToolPath(host: Host, tool: string): string | undefined {
    return host.getConfiguration(EXTENSION_CONFIG_KEY)[toolPathKey(tool)];
}

export function toolPathKey(tool: string) {
    return `vs-kubernetes.${tool}-path`;
}

// Auto cleanup on debug terminate

const AUTO_CLEANUP_DEBUG_KEY = "vs-kubernetes.autoCleanupOnDebugTerminate";

export function getAutoCompleteOnDebugTerminate(): boolean {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)[AUTO_CLEANUP_DEBUG_KEY];
}

export async function setAlwaysCleanUp(): Promise<void> {
    // The object returned by VS Code API is readonly, clone it first.
    const oldConfig = vscode.workspace.getConfiguration().inspect(EXTENSION_CONFIG_KEY);
    // Always update global config.
    const globalConfig = <any> Object.assign({}, oldConfig.globalValue);
    globalConfig[AUTO_CLEANUP_DEBUG_KEY] = true;
    await vscode.workspace.getConfiguration().update(EXTENSION_CONFIG_KEY, globalConfig, vscode.ConfigurationTarget.Global);
    // If workspace folder value exists, update it.
    if (oldConfig.workspaceFolderValue && oldConfig.workspaceFolderValue[AUTO_CLEANUP_DEBUG_KEY] === false) {
        const workspaceFolderConfig = <any> Object.assign({}, oldConfig.workspaceFolderValue);
        workspaceFolderConfig[AUTO_CLEANUP_DEBUG_KEY] = true;
        await vscode.workspace.getConfiguration().update(EXTENSION_CONFIG_KEY, workspaceFolderConfig, vscode.ConfigurationTarget.WorkspaceFolder);
    } else if (oldConfig.workspaceValue && oldConfig.workspaceValue[AUTO_CLEANUP_DEBUG_KEY] === false) { // if workspace value exists, update it.
        const workspaceConfig = <any> Object.assign({}, oldConfig.workspaceValue);
        workspaceConfig[AUTO_CLEANUP_DEBUG_KEY] = true;
        await vscode.workspace.getConfiguration().update(EXTENSION_CONFIG_KEY, workspaceConfig, vscode.ConfigurationTarget.Workspace);
    }
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
