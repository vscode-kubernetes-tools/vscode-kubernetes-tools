import * as vscode from 'vscode';

export async function promptForDebugPort(defaultPort: string): Promise<string> {
    const input = await vscode.window.showInputBox({
        prompt: `Please specify debug port exposed for debugging (e.g. ${defaultPort})`,
        placeHolder: defaultPort
    });
    return input && input.trim();
}
