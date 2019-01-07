import * as vscode from 'vscode';

export class HelmRequirementsCodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses(doc: vscode.TextDocument, tok: vscode.CancellationToken): vscode.CodeLens[] {
        if (!doc.fileName.endsWith("requirements.yaml")) {
            return;
        }

        // Find the dependencies section
        const i = doc.getText().indexOf("dependencies:");
        const start = doc.positionAt(i);
        const range = doc.getWordRangeAtPosition(start);
        if (range.isEmpty) {
            return;
        }

        const update = new vscode.CodeLens(range, {
            title: "update dependencies",
            command: "extension.helmDepUp",
            arguments: [doc]
        });
        const insert = new vscode.CodeLens(range, {
            title: "insert dependency",
            command: "extension.helmInsertReq",
        });

        return [update, insert];
    }
}
