import * as assert from 'assert';
import * as vscode from 'vscode';

import * as cf from '../../src/yaml-support/consideration-filter';

let tempDocumentId = 0;

suite("YAML consideration-filter", () => {
    suite("shouldProvideSchemaFor method", () => {

        test("...defaults to true", async () => {
            const document = await createYamlDocument('kind: Deployment\n');
            assert.strictEqual(true, cf.shouldProvideSchemaFor(document));
        });

        test("...is false if exclude is set", async () => {
            const document = await createYamlDocument('# vscode-kubernetes-tools: exclude');
            assert.strictEqual(false, cf.shouldProvideSchemaFor(document));
        });

        test("...is true if include is set", async () => {
            const document = await createYamlDocument('# vscode-kubernetes-tools: include');
            assert.strictEqual(true, cf.shouldProvideSchemaFor(document));
        });

        test("...ignores other leading comments", async () => {
            const document = await createYamlDocument('# $schema: something\n# vscode-kubernetes-tools: exclude\nkind: Deployment\n');
            assert.strictEqual(false, cf.shouldProvideSchemaFor(document));
        });

        test("...ignores blank lines", async () => {
            const document = await createYamlDocument('\n# $schema: something\n\n\n# vscode-kubernetes-tools: exclude\nkind: Deployment\n');
            assert.strictEqual(false, cf.shouldProvideSchemaFor(document));
        });

        test("...requires annotation to appear before Big YAML", async () => {
            const document = await createYamlDocument('\n# $schema: something\n\nkind: Deployment\n\n# vscode-kubernetes-tools: exclude\n');
            assert.strictEqual(true, cf.shouldProvideSchemaFor(document));
        });

    });
});

async function createYamlDocument(text: string): Promise<vscode.TextDocument> {
    ++tempDocumentId;
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(`untitled:temp-${tempDocumentId}.yaml`));
    const editor = await vscode.window.showTextDocument(document);
    await editor.edit((e) => e.insert(new vscode.Position(0, 0), text));
    return document;
}
