import * as vscode from "vscode";

export async function preview(uri: vscode.Uri, column: vscode.ViewColumn, tabTitle: string): Promise<void> {
    const html = await getHTML(uri);
    const w = vscode.window.createWebviewPanel('vsk8s-preview', tabTitle, column, {
        retainContextWhenHidden: false,
        enableScripts: false,
    });
    w.webview.html = html;
    w.reveal();
}

async function getHTML(uri: vscode.Uri): Promise<string> {
    const doc = await vscode.workspace.openTextDocument(uri);
    return doc.getText();
}

export async function openHelmGeneratedValuesFile(uri: vscode.Uri): Promise<void> {
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        if (document) {
            vscode.window.showTextDocument(document);
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Error loading document: ${err}`);
    }
}
