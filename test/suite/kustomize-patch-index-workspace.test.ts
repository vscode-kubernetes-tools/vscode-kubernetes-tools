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

// Holds open the next `count` reads of `target`, and passes every other read straight
// through -- including a later read of `target` itself. The reads being held open are the
// watcher's; a reconciling scan now reads the keys it has not accounted for, so it reads
// this file too, and holding that read as well would leave the scan unable to finish.
function holdNextReads(target: vscode.Uri, count: number, contents: string): Array<() => void> {
    const gates: Array<() => void> = [];
    let remaining = count;
    const passThrough = index.forTesting.readFile;
    index.forTesting.readFile = async (uri: vscode.Uri) => {
        if (uri.fsPath !== target.fsPath || remaining <= 0) {
            return passThrough(uri);
        }
        remaining--;
        await new Promise<void>((resolve) => gates.push(resolve));
        return Buffer.from(contents);
    };
    return gates;
}

// The race Tatsinnit reported on #2009: a first-time watcher read is still in flight when
// a reconciling scan runs. The key is not in patchesByKustomization yet, so the scan never
// saw it, never claimed a token for it, and the read publishes afterwards -- paths the
// workspace no longer has any file for.
//
// Reproduced here by holding the read open across the scan rather than by removing a
// workspace folder, which needs timing the test cannot control. The mechanic is the same:
// what matters is that the scan does not know about the pending read.
suite("Kustomize patch index, pending read against a rescan", () => {

    const original = index.forTesting.readFile;

    // Reads here publish entries for a kustomization that is not on disk, so the index is
    // put back to what the filesystem says between tests: a leftover ghost entry would
    // give a later test a reconciling scan that prunes the key for an unrelated reason,
    // and the pending-read bookkeeping under test would never be exercised.
    teardown(async () => {
        index.forTesting.readFile = original;
        await index.forTesting.rescan();
    });

    test("...discards a read the reconciling scan did not know about", async function () {
        this.timeout(20000);

        const ghost = fixtureUri(...GHOST_KUSTOMIZATION);
        const gates = holdNextReads(ghost, 1, 'patches:\n  - path: patch.yaml\n');

        // Starts the read and claims a token, but publishes nothing yet.
        const reading = index.forTesting.reindexOne(ghost);

        // A scan that does not find the ghost: it is not on disk, so findFiles cannot
        // return it, exactly as if its folder had gone. Its own read of the key fails for
        // the same reason, which is the answer that the key is no longer there.
        await index.forTesting.rescan();

        gates[0]();
        await reading;

        assert.strictEqual(false, index.isKustomizePatch(fixtureUri(...GHOST_PATCH)),
            'a read the scan did not know about published after it');
    });

    test("...keeps tracking an overlapping read when an earlier one for the same key finishes", async function () {
        this.timeout(20000);

        const ghost = fixtureUri(...GHOST_KUSTOMIZATION);
        const gates = holdNextReads(ghost, 2, 'patches:\n  - path: patch.yaml\n');

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

// The findFiles() await is its own boundary, and the two schedules below sit on either
// side of it. Both are a key the walk did not return while a read for it was in play, and
// timing alone does not separate them: what does is whether the file is there now. The
// walk's results are a snapshot that has already aged by the time the scan commits, so a
// key it did not return is a question the scan has to ask again rather than answer from
// that snapshot.
suite("Kustomize patch index, the findFiles boundary", () => {

    const originalReadFile = index.forTesting.readFile;
    const originalFindFiles = index.forTesting.findFiles;

    teardown(async () => {
        index.forTesting.readFile = originalReadFile;
        index.forTesting.findFiles = originalFindFiles;
        await index.forTesting.rescan();
    });

    // A kustomization that went with its directory: the file is gone, and a file-level
    // glob never saw it go (microsoft/vscode#60813), which is why a scan reconciles at all.
    test("...prunes a read that landed while the walk was still going", async function () {
        this.timeout(20000);

        const ghost = fixtureUri(...GHOST_KUSTOMIZATION);
        const gates = holdNextReads(ghost, 1, 'patches:\n  - path: patch.yaml\n');
        let releaseWalk: () => void;
        const walkHeld = new Promise<void>((resolve) => { releaseWalk = resolve; });

        index.forTesting.findFiles = async (glob: string) => {
            await walkHeld;
            return originalFindFiles(glob);  // the ghost is not on disk, so never returned
        };

        const reading = index.forTesting.reindexOne(ghost);
        const scanning = index.forTesting.rescan();  // started, then waiting on the walk

        // The read lands mid-walk: it publishes, and clears its own pending marker, before
        // the scan has reached the point where it decides anything.
        gates[0]();
        await reading;

        releaseWalk!();
        await scanning;

        assert.strictEqual(false, index.isKustomizePatch(fixtureUri(...GHOST_PATCH)),
            'a read that landed mid-walk left paths for a kustomization the scan did not find');
    });

    // The mirror: the file is there, the walk just passed its directory before it existed.
    // The scan has no result for it and must leave the watcher's read alone.
    test("...keeps a read for a file the walk missed but that is on disk", async function () {
        this.timeout(20000);

        const missed = fixtureUri('extensionless', 'Kustomization');
        const contents = Buffer.from(await originalReadFile(missed)).toString('utf8');
        const gates = holdNextReads(missed, 1, contents);
        let releaseWalk: () => void;
        const walkHeld = new Promise<void>((resolve) => { releaseWalk = resolve; });

        index.forTesting.findFiles = async (glob: string) => {
            await walkHeld;
            const all = await originalFindFiles(glob);
            return all.filter((uri) => uri.fsPath !== missed.fsPath);
        };

        const scanning = index.forTesting.rescan();   // started, waiting on the walk
        const reading = index.forTesting.reindexOne(missed);  // the create the walk missed

        // The walk finishes and the scan claims, with this read still in flight.
        releaseWalk!();
        await scanning;

        gates[0]();
        await reading;

        assert.strictEqual(true, index.isKustomizePatch(fixtureUri('extensionless', 'patch-service.yaml')),
            'the scan discarded a read for a file it had no result for');
    });

});

function fixtureUri(...segments: string[]): vscode.Uri {
    const folders = vscode.workspace.workspaceFolders;
    assert.ok(folders && folders.length > 0, 'expected the fixture workspace to be open');
    return vscode.Uri.file(path.join(folders[0].uri.fsPath, ...segments));
}
