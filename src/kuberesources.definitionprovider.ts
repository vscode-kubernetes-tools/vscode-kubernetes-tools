import * as vscode from 'vscode';

export class KubernetesResourceDefinitionProvider implements vscode.DefinitionProvider {
    public provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition> {
        return this.provideDefinitionAsync(document, position);
    }

    async provideDefinitionAsync(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Definition> {
        return new vscode.Location(document.uri, new vscode.Position(0, 0));
    }
}
