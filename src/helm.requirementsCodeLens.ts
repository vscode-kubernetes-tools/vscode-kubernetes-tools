import * as vscode from 'vscode';

export class HelmRequirementsCodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses(doc: vscode.TextDocument, tok: vscode.CancellationToken): vscode.CodeLens[] {
        if (!doc.fileName.endsWith("requirements.yaml")) {
            return;
        }

        // Find the dependencies section
        let i = doc.getText().indexOf("dependencies:");
        let start = doc.positionAt(i);
        let range = doc.getWordRangeAtPosition(start);
        if (range.isEmpty) {
            return;
        }

        let update = new vscode.CodeLens(range, {
            title: "update dependencies",
            command: "extension.helmDepUp"
        });
        let insert = new vscode.CodeLens(range, {
            title: "insert dependency",
            command: "extension.helmInsertReq",
        });

        return [update, insert];
    }
}