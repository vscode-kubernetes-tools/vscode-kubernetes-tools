import * as vscode from 'vscode';
import * as path from 'path';
import { shellEnvironment } from './shell';
import { showWorkspaceFolderPick } from './hostutils';
import { Dictionary } from './utils/dictionary';

export interface Host {
    showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined>;
    showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined>;
    showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined>;
    showInputBox(options: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string | undefined>;
    showQuickPick(items: string[], options: vscode.QuickPickOptions): Thenable<string | undefined>;
    showQuickPick<T extends vscode.QuickPickItem>(items: T[], options: vscode.QuickPickOptions): Thenable<T | undefined>;
    withProgress<R>(task: (progress: vscode.Progress<{ message?: string }>) => Thenable<R>): Thenable<R>;
    getConfiguration(key: string): any;
    createTerminal(name?: string, shellPath?: string, shellArgs?: string[], iconPath?: vscode.ThemeIcon): vscode.Terminal;
    runProcessInTerminal(options: ProcessTerminalOptions): Promise<ProcessTerminalExecution>;
    onDidCloseTerminal(listener: (e: vscode.Terminal) => any): vscode.Disposable;
    onDidChangeConfiguration(listener: (ch: vscode.ConfigurationChangeEvent) => any): vscode.Disposable;
    activeDocument(): vscode.TextDocument | undefined;
    showDocument(uri: vscode.Uri): Promise<vscode.TextDocument>;
    readDocument(uri: vscode.Uri): Promise<vscode.TextDocument>;
    selectRootFolder(): Promise<string | undefined>;
    longRunning<T>(uiOptions: string | LongRunningUIOptions, action: () => Promise<T>): Promise<T>;
}

export const host: Host = {
    showErrorMessage : showErrorMessage,
    showWarningMessage : showWarningMessage,
    showInformationMessage : showInformationMessage,
    showQuickPick : showQuickPickAny,
    withProgress: withProgress,
    getConfiguration : getConfiguration,
    createTerminal : createTerminal,
    runProcessInTerminal: runProcessInTerminal,
    onDidCloseTerminal : onDidCloseTerminal,
    onDidChangeConfiguration : onDidChangeConfiguration,
    showInputBox : showInputBox,
    activeDocument : activeDocument,
    showDocument : showDocument,
    readDocument : readDocument,
    selectRootFolder : selectRootFolder,
    longRunning : longRunning
};

export interface LongRunningUIOptions {
    readonly title: string;
    readonly operationKey?: string;
}

export interface ProcessTerminalOptions {
    readonly name: string;
    readonly executable: string;
    readonly args: readonly string[];
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
}

export interface ProcessTerminalExecution {
    readonly completed: Promise<void>;
    terminate(): void;
}

function showInputBox(options: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string | undefined> {
    return vscode.window.showInputBox(options, token);
}

function showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
    return vscode.window.showErrorMessage(message, ...items);
}

function showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined> {
    return vscode.window.showWarningMessage(message, ...items);
}

function showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined> {
    return vscode.window.showInformationMessage(message, ...items);
}

function showQuickPickStr(items: string[], options?: vscode.QuickPickOptions): Thenable<string | undefined> {
    return vscode.window.showQuickPick(items, options);
}

function showQuickPickT<T extends vscode.QuickPickItem>(items: T[], options?: vscode.QuickPickOptions): Thenable<T | undefined> {
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

function withProgress<R>(task: (progress: vscode.Progress<{ message?: string }>) => Thenable<R>): Thenable<R> {
    return vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, task);
}

function getConfiguration(key: string): any {
    return vscode.workspace.getConfiguration(key);
}

function createTerminal(name?: string, shellPath?: string, shellArgs?: string[], iconPath?: vscode.ThemeIcon): vscode.Terminal {
    const terminalOptions = {
        name: name,
        shellPath: shellPath,
        shellArgs: shellArgs,
        env: shellEnvironment(process.env),
        iconPath: iconPath
    };
    return vscode.window.createTerminal(terminalOptions);
}

export function createProcessTerminalOptions(options: ProcessTerminalOptions): vscode.TerminalOptions {
    return {
        name: options.name,
        shellPath: process.execPath,
        shellArgs: processTerminalRunnerArgs(options),
        // The child's working directory is encoded below. Keep VS Code's terminal resolver away from it.
        cwd: path.parse(process.execPath).root,
        env: {
            ELECTRON_RUN_AS_NODE: '1',
            VSCODE_KUBERNETES_PROCESS_ENV: encodedEnvironment(options.env),
        },
        strictEnv: true,
        isTransient: true,
    };
}

async function runProcessInTerminal(options: ProcessTerminalOptions): Promise<ProcessTerminalExecution> {
    const terminal = vscode.window.createTerminal(createProcessTerminalOptions(options));
    let complete!: () => void;
    const completed = new Promise<void>((resolve) => { complete = resolve; });
    const closeListener = vscode.window.onDidCloseTerminal((closedTerminal) => {
        if (closedTerminal === terminal) {
            closeListener.dispose();
            complete();
        }
    });
    try {
        terminal.show();
        if (await terminal.processId === undefined) {
            throw new Error('The terminal process did not start.');
        }
        return { completed, terminate: () => terminal.dispose() };
    } catch (error) {
        closeListener.dispose();
        terminal.dispose();
        complete();
        throw error;
    }
}

interface ProcessTerminalPayload {
    readonly executable: string;
    readonly args: readonly string[];
    readonly cwd?: string;
}

const PROCESS_TERMINAL_RUNNER = [
    'const {spawn}=require("child_process");',
    'const p=JSON.parse(Buffer.from(process.argv[1],"base64url").toString("utf8"));',
    'const env=JSON.parse(Buffer.from(process.env.VSCODE_KUBERNETES_PROCESS_ENV,"base64url").toString("utf8"));',
    'let failed=false;',
    'const child=spawn(p.executable,p.args,{cwd:p.cwd,env,shell:false,stdio:"inherit",windowsHide:true});',
    'let stopping=false;',
    'let finished=false;',
    'let exitAfterChild=false;',
    'const forward=(signal,exit)=>{exitAfterChild||=exit;if(finished){process.exit();return;}if(stopping)return;stopping=true;if(child.exitCode===null&&child.signalCode===null){child.kill(signal);const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill("SIGKILL");},2000);timer.unref();}};',
    'process.on("SIGINT",()=>forward("SIGINT",false));',
    'process.on("SIGTERM",()=>forward("SIGTERM",true));',
    'if(process.platform!=="win32")process.on("SIGHUP",()=>forward("SIGHUP",true));',
    'child.once("error",(error)=>{failed=true;console.error(error.message);process.exitCode=1;});',
    'child.once("close",(code)=>{finished=true;process.exitCode=failed?1:(code??1);if(exitAfterChild)process.exit();else if(process.stdin.isTTY&&process.stdout.isTTY)process.stdin.resume();});',
].join('');

export function processTerminalRunnerArgs(options: ProcessTerminalOptions): string[] {
    // Keep variable-like values opaque to VS Code. The fixed runner decodes the invocation and creates the child
    // with shell:false inside the real terminal PTY.
    const payload: ProcessTerminalPayload = {
        executable: options.executable,
        args: [...options.args],
        cwd: options.cwd || process.cwd(),
    };
    return ['-e', PROCESS_TERMINAL_RUNNER, Buffer.from(JSON.stringify(payload)).toString('base64url')];
}

function encodedEnvironment(environment: NodeJS.ProcessEnv | undefined): string {
    return Buffer.from(JSON.stringify(definedEnvironment(environment || process.env))).toString('base64url');
}

function definedEnvironment(environment: NodeJS.ProcessEnv): Record<string, string> {
    return Object.fromEntries(
        Object.entries(environment).filter((entry): entry is [string, string] => entry[1] !== undefined)
    );
}

function onDidCloseTerminal(listener: (e: vscode.Terminal) => any): vscode.Disposable {
    return vscode.window.onDidCloseTerminal(listener);
}

function onDidChangeConfiguration(listener: (e: vscode.ConfigurationChangeEvent) => any): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(listener);
}

function activeDocument(): vscode.TextDocument | undefined {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        return activeEditor.document;
    }
    return undefined;
}

async function showDocument(uri: vscode.Uri): Promise<vscode.TextDocument> {
    const document = await vscode.workspace.openTextDocument(uri);
    if (document) {
        await vscode.window.showTextDocument(document);
    }
    return document;
}

async function readDocument(uri: vscode.Uri): Promise<vscode.TextDocument> {
    return await vscode.workspace.openTextDocument(uri);
}

async function selectRootFolder(): Promise<string | undefined> {
    const folder = await showWorkspaceFolderPick();
    if (!folder) {
        return undefined;
    }
    if (folder.uri.scheme !== 'file') {
        vscode.window.showErrorMessage("This command requires a filesystem folder");  // TODO: make it not
        return undefined;
    }
    return folder.uri.fsPath;
}

const ACTIVE_LONG_RUNNING_OPERATIONS = Dictionary.of<boolean>();

async function longRunning<T>(uiOptions: string | LongRunningUIOptions, action: () => Promise<T>): Promise<T> {
    const uiOptionsObj = uiOptionsObjectOf(uiOptions);
    const options = {
        location: vscode.ProgressLocation.Notification,
        title: uiOptionsObj.title
    };
    return await underLongRunningOperationKeyGuard(uiOptionsObj.operationKey, async (alreadyShowingUI) =>
        alreadyShowingUI ?
            await action() :
            await vscode.window.withProgress(options, (_) => action())
    );
}

async function underLongRunningOperationKeyGuard<T>(operationKey: string | undefined, action: (alreadyShowingUI: boolean) => Promise<T>): Promise<T> {
    const alreadyShowingUI = !!operationKey && (ACTIVE_LONG_RUNNING_OPERATIONS[operationKey] || false);
    if (operationKey) {
        ACTIVE_LONG_RUNNING_OPERATIONS[operationKey] = true;
    }
    try {
        const result = await action(alreadyShowingUI);
        return result;
    } finally {
        if (operationKey) {
            delete ACTIVE_LONG_RUNNING_OPERATIONS[operationKey];
        }
    }
}

function uiOptionsObjectOf(uiOptions: string | LongRunningUIOptions): LongRunningUIOptions {
    if (isLongRunningUIOptions(uiOptions)) {
        return uiOptions;
    }
    return { title: uiOptions };
}

function isLongRunningUIOptions(obj: string | LongRunningUIOptions): obj is LongRunningUIOptions {
    return !!((obj as LongRunningUIOptions).title);
}
