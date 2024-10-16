import * as vscode from 'vscode';

export function copyTextToClipboard(text: string): void {
    vscode.env.clipboard.writeText(text).then(
        () => {
            vscode.window.showInformationMessage(`${text} copied to clipboard!`);
        },
        (err) => {
            vscode.window.showErrorMessage('Failed to copy text: ' + err);
        }
    );
}
