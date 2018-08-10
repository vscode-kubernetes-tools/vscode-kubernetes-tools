import * as vscode from 'vscode';

export async function addPathToConfig(configKey: string, value: string): Promise<void> {
    const config = vscode.workspace.getConfiguration().inspect("vs-kubernetes");
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
    await vscode.workspace.getConfiguration().update("vs-kubernetes", newValue, scope);
}

export async function addValueToConfigArray(configKey: string, value: string): Promise<void> {
    const config = vscode.workspace.getConfiguration().inspect("vs-kubernetes");
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
    await vscode.workspace.getConfiguration().update("vs-kubernetes", newValue, scope);
}
