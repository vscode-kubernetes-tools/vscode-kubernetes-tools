import * as vscode from 'vscode';
import { shellEnvironment } from './shell';

export interface Host {
    showErrorMessage(message: string, ...items: string[]): Thenable<string>;
    showWarningMessage(message: string, ...items: string[]): Thenable<string>;
    showInformationMessage(message: string, ...items: string[]): Thenable<string>;
    showInputBox(options: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string>;
    showQuickPick(items: string[], options: vscode.QuickPickOptions): Thenable<string>;
    showQuickPick<T extends vscode.QuickPickItem>(items: T[], options: vscode.QuickPickOptions): Thenable<T>;
    withProgress<R>(task: (progress: vscode.Progress<{ message?: string; }>) => Thenable<R>): Thenable<R>;
    getConfiguration(key: string): any;
    createTerminal(name?: string, shellPath?: string, shellArgs?: string[]): vscode.Terminal;
    onDidCloseTerminal(listener: (e: vscode.Terminal) => any): vscode.Disposable;
    onDidChangeConfiguration(listener: (ch: vscode.ConfigurationChangeEvent) => any): vscode.Disposable;
}

export const host: Host = {
    showErrorMessage : showErrorMessage,
    showWarningMessage : showWarningMessage,
    showInformationMessage : showInformationMessage,
    showQuickPick : showQuickPickAny,
    withProgress: withProgress,
    getConfiguration : getConfiguration,
    createTerminal : createTerminal,
    onDidCloseTerminal : onDidCloseTerminal,
    onDidChangeConfiguration : onDidChangeConfiguration,
    showInputBox : showInputBox
};

function showInputBox(options: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> {
    return vscode.window.showInputBox(options, token);
}

function showErrorMessage(message: string, ...items: string[]): Thenable<string> {
    return vscode.window.showErrorMessage(message, ...items);
}

function showWarningMessage(message: string, ...items: string[]): Thenable<string> {
    return vscode.window.showWarningMessage(message, ...items);
}

function showInformationMessage(message: string, ...items: string[]): Thenable<string> {
    return vscode.window.showInformationMessage(message, ...items);
}

function showQuickPickStr(items: string[], options?: vscode.QuickPickOptions): Thenable<string> {
    return vscode.window.showQuickPick(items, options);
}

function showQuickPickT<T extends vscode.QuickPickItem>(items: T[], options?: vscode.QuickPickOptions): Thenable<T> {
    return vscode.window.showQuickPick(items, options);
}

function showQuickPickAny(items: any, options: vscode.QuickPickOptions): any {
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

function getConfiguration(key: string): any {
    return vscode.workspace.getConfiguration(key);
}

function createTerminal(name?: string, shellPath?: string, shellArgs?: string[]): vscode.Terminal {
    const terminalOptions = {
        name: name,
        shellPath: shellPath,
        shellArgs: shellArgs,
        env: shellEnvironment(process.env)
    };
    return vscode.window.createTerminal(terminalOptions);
}

function onDidCloseTerminal(listener: (e: vscode.Terminal) => any): vscode.Disposable {
    return vscode.window.onDidCloseTerminal(listener);
}

function onDidChangeConfiguration(listener: (e: vscode.ConfigurationChangeEvent) => any): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(listener);
}
