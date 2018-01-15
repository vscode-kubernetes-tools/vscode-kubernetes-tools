import * as vscode from 'vscode';

export interface Host {
    showErrorMessage(message : string, ...items : string[]) : Thenable<string>;
    showWarningMessage(message : string, ...items : string[]) : Thenable<string>;
    showInformationMessage(message : string, ...items : string[]) : Thenable<string>;
    showQuickPick(items : string[], options : vscode.QuickPickOptions) : Thenable<string>;
    showQuickPick<T extends vscode.QuickPickItem>(items : T[], options : vscode.QuickPickOptions) : Thenable<T>;
    withProgress<R>(task: (progress: vscode.Progress<{ message?: string; }>) => Thenable<R>): Thenable<R>;
    getConfiguration(key : string) : any;
}

export const host : Host = {
    showErrorMessage : showErrorMessage,
    showWarningMessage : showWarningMessage,
    showInformationMessage : showInformationMessage,
    showQuickPick : showQuickPickAny,
    withProgress: withProgress,
    getConfiguration : getConfiguration,
};

function showErrorMessage(message : string, ...items : string[]) : Thenable<string> {
    return vscode.window.showErrorMessage(message, ...items);
}

function showWarningMessage(message : string, ...items : string[]) : Thenable<string> {
    return vscode.window.showWarningMessage(message, ...items);
}

function showInformationMessage(message : string, ...items : string[]) : Thenable<string> {
    return vscode.window.showInformationMessage(message, ...items);
}

function showQuickPickStr(items : string[], options? : vscode.QuickPickOptions) : Thenable<string> {
    return vscode.window.showQuickPick(items, options);
}

function showQuickPickT<T extends vscode.QuickPickItem>(items : T[], options? : vscode.QuickPickOptions) : Thenable<T> {
    return vscode.window.showQuickPick(items, options);
}

function showQuickPickAny(items : any, options : vscode.QuickPickOptions) : any {
    if (!Array.isArray(items)) {
        throw 'unexpected type passed to showQuickPick';
    }

    if (items.length === 0) {
        return showQuickPickStr(items, options);
    }

    const item = items[0];
    if (typeof item === 'string' || item instanceof String) {
        return showQuickPickStr(items, options);
    } else {
        return showQuickPickT(items, options);
    }
}

function withProgress<R>(task: (progress: vscode.Progress<{ message?: string; }>) => Thenable<R>): Thenable<R> {
    return vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, task);
}

function getConfiguration(key : string) : any {
    return vscode.workspace.getConfiguration(key);
}
