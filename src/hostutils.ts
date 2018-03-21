import * as vscode from 'vscode';

export async function showWorkspaceFolderPick(): Promise<vscode.WorkspaceFolder> {
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('This command requires an open folder.');
        return undefined;
    } else if (vscode.workspace.workspaceFolders.length === 1) {
        return vscode.workspace.workspaceFolders[0];
    }
    return await vscode.window.showWorkspaceFolderPick();
}

