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
        await index.initialise(context);
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

// A kustomization that exists only as a path: findFiles never returns it, which is what
// puts it outside the scan's scope. The read is supplied by the stub below.
const GHOST_KUSTOMIZATION = ['ghost', 'kustomization.yaml'];
const GHOST_PATCH = ['ghost', 'patch.yaml'];

// The race Tatsinnit reported on #2009: a first-time watcher read is still in flight when
// a reconciling scan runs. The key is not in patchesByKustomization yet, so the scan never
// saw it, never claimed a token for it, and the read publishes afterwards -- paths the
// workspace no longer has any file for.
//
// Reproduced here by holding the read open across the scan rather than by removing a
// workspace folder, which needs timing the test cannot control. The mechanic is the same:
// what matters is that the scan does not know about the pending read.
suite("Kustomize patch index, pending read against a rescan", () => {

    let release: (() => void) | undefined;
    const original = index.forTesting.readFile;

    // Reads here publish entries for a kustomization that is not on disk, so the index is
    // put back to what the filesystem says between tests: a leftover ghost entry would
    // give a later test a reconciling scan that prunes the key for an unrelated reason,
    // and the pending-read bookkeeping under test would never be exercised.
    teardown(async () => {
        index.forTesting.readFile = original;
        release = undefined;
        await index.forTesting.rescan();
    });

    test("...discards a read the reconciling scan did not know about", async function () {
        this.timeout(20000);

        const ghost = fixtureUri(...GHOST_KUSTOMIZATION);
        const held = new Promise<void>((resolve) => { release = resolve; });

        index.forTesting.readFile = async (uri: vscode.Uri) => {
            if (uri.fsPath !== ghost.fsPath) {
                return original(uri);
            }
            await held;  // keep this read in flight until the scan has finished
            return Buffer.from('patches:\n  - path: patch.yaml\n');
        };

        // Starts the read and claims a token, but publishes nothing yet.
        const reading = index.forTesting.reindexOne(ghost);

        // A scan that does not find the ghost: it is not on disk, so findFiles cannot
        // return it, exactly as if its folder had gone.
        await index.forTesting.rescan();

        release!();
        await reading;

        assert.strictEqual(false, index.isKustomizePatch(fixtureUri(...GHOST_PATCH)),
            'a read the scan did not know about published after it');
    });

    test("...keeps tracking an overlapping read when an earlier one for the same key finishes", async function () {
        this.timeout(20000);

        const ghost = fixtureUri(...GHOST_KUSTOMIZATION);
        const gates: Array<() => void> = [];

        index.forTesting.readFile = async (uri: vscode.Uri) => {
            if (uri.fsPath !== ghost.fsPath) {
                return original(uri);
            }
            await new Promise<void>((resolve) => gates.push(resolve));
            return Buffer.from('patches:\n  - path: patch.yaml\n');
        };

        // Two reads of the same kustomization, overlapping -- two edits in quick
        // succession give the watcher exactly this. Each runs synchronously as far as the
        // held read, so both are in flight here.
        const readA = index.forTesting.reindexOne(ghost);
        const readB = index.forTesting.reindexOne(ghost);
        assert.strictEqual(2, gates.length, 'expected both reads to be in flight');

        // The older read lands first. Its own generation guard discards its result; what
        // matters is whether it also drops the tracking the still-pending read needs.
        gates[0]();
        await readA;

        // A scan that does not find the ghost, as before.
        await index.forTesting.rescan();

        gates[1]();
        await readB;

        assert.strictEqual(false, index.isKustomizePatch(fixtureUri(...GHOST_PATCH)),
            'an earlier read dropped the tracking the scan needed to invalidate a later one');
    });

    test("...still indexes a read that no scan overtook", async function () {
        this.timeout(20000);

        const ghost = fixtureUri(...GHOST_KUSTOMIZATION);
        index.forTesting.readFile = async (uri: vscode.Uri) =>
            uri.fsPath === ghost.fsPath
                ? Buffer.from('patches:\n  - path: patch.yaml\n')
                : original(uri);

        await index.forTesting.reindexOne(ghost);

        assert.strictEqual(true, index.isKustomizePatch(fixtureUri(...GHOST_PATCH)),
            'the guard rejected a read nothing superseded');
    });

});

function fixtureUri(...segments: string[]): vscode.Uri {
    const folders = vscode.workspace.workspaceFolders;
    assert.ok(folders && folders.length > 0, 'expected the fixture workspace to be open');
    return vscode.Uri.file(path.join(folders[0].uri.fsPath, ...segments));
}
