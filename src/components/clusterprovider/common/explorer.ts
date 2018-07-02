import * as vscode from 'vscode';

export async function refreshExplorer(): Promise<void> {
    await vscode.commands.executeCommand('extension.vsKubernetesRefreshExplorer');
}