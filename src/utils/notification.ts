import * as vscode from "vscode";


export async function longRunning<T>(title: string, action: () => Promise<T>): Promise<T> {
    const options = {
        location: vscode.ProgressLocation.Notification,
        title: title,
    };
    return await vscode.window.withProgress(options, () => action());
}