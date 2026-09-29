import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

import * as index from '../../src/yaml-support/kustomize-patch-index';

// Exercises the index against the fixture workspace opened by runTest.ts, rather than the
// path parsing covered in kustomize-patch-index.test.ts. The module is driven directly:
// tests run against the TypeScript sources in out/, whereas activating the extension would
// load the webpack bundle in dist/, which is not rebuilt as part of `npm test`.

suite("Kustomize patch index against a workspace", () => {

    suiteSetup(async function () {
        this.timeout(20000);
        const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        const indexed = new Promise<void>((resolve) => {
            const subscription = index.onDidChange(() => {
                subscription.dispose();
                resolve();
            });
        });
        index.initialise(context);
        await indexed;
    });

    test("...recognises a file the kustomization names as a patch", () => {
        assert.strictEqual(true, index.isKustomizePatch(fixtureUri('patch-deployment.yaml')));
    });

    test("...does not recognise a file listed under resources", () => {
        assert.strictEqual(false, index.isKustomizePatch(fixtureUri('deployment.yaml')));
    });

    test("...does not recognise the kustomization itself", () => {
        assert.strictEqual(false, index.isKustomizePatch(fixtureUri('kustomization.yaml')));
    });

    // kustomize recognises `Kustomization` with no extension as well as the two .yaml/.yml
    // spellings, so the index has to pick it up.
    test("...reads a kustomization named `Kustomization` with no extension", () => {
        assert.strictEqual(true, index.isKustomizePatch(fixtureUri('extensionless', 'patch-service.yaml')));
    });

    test("...does not recognise a file listed under resources of an extensionless kustomization", () => {
        assert.strictEqual(false, index.isKustomizePatch(fixtureUri('extensionless', 'service.yaml')));
    });

    test("...does not recognise a file nothing points at", () => {
        assert.strictEqual(false, index.isKustomizePatch(fixtureUri('not-mentioned-anywhere.yaml')));
    });

    test("...does not recognise documents that aren't files", () => {
        assert.strictEqual(false, index.isKustomizePatch(vscode.Uri.parse('untitled:whatever.yaml')));
    });

});

function fixtureUri(...segments: string[]): vscode.Uri {
    const folders = vscode.workspace.workspaceFolders;
    assert.ok(folders && folders.length > 0, 'expected the fixture workspace to be open');
    return vscode.Uri.file(path.join(folders[0].uri.fsPath, ...segments));
}
