import * as path from 'path';
import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

// Kustomize patch files are partial resources by design: they carry only the fields to be
// merged over a base, so they legitimately lack properties the schema requires and
// resources the linters expect. Treating them as complete Kubernetes objects produces
// warnings about a file that is correct.
//
// We can't tell that from the file itself - a patch looks like a truncated resource, and
// so does a resource someone is halfway through writing. What does distinguish them is
// that a kustomization.yaml names the patch. So we index what the kustomizations in the
// workspace point at, and let the consideration filter exclude those files.
//
// The lookup must be synchronous: vscode-yaml's schema contributor API is synchronous, and
// linting runs on every keystroke. Hence an index maintained in the background rather than
// reading kustomization.yaml on demand.

// The three names kustomize itself recognises, and only those: see
// RecognizedKustomizationFileNames in kustomize's api/konfig/general.go. In particular
// `Kustomization` carries no extension, and `Kustomization.yaml` is not a kustomization at
// all on a case-sensitive filesystem.
const KUSTOMIZATION_GLOB = '**/{kustomization.yaml,kustomization.yml,Kustomization}';

// Patch paths keyed by the kustomization that declared them, so that editing one
// kustomization only re-indexes that file.
const patchesByKustomization = new Map<string, readonly string[]>();

// Reads are asynchronous and can overlap, so a slow read of an earlier revision could
// otherwise finish last and republish stale paths. Every attempt to change what we know
// about a kustomization takes a new token; only the newest token may write.
const generations = new Map<string, number>();

let rescanGeneration = 0;

let allPatchPaths = new Set<string>();

const onDidChangeEmitter = new vscode.EventEmitter<void>();

// Fires whenever the set of known patch files changes. Editing a kustomization without
// altering the files it names as patches does not fire. Consumers should re-evaluate any
// documents they have already processed.
//
// It says nothing about the initial scan, which is what awaiting initialise() is for.
export const onDidChange = onDidChangeEmitter.event;

export function isKustomizePatch(uri: vscode.Uri): boolean {
    if (uri.scheme !== 'file') {
        return false;
    }
    return allPatchPaths.has(normalisePath(uri.fsPath));
}

function coversAKnownKustomization(uri: vscode.Uri): boolean {
    if (uri.scheme !== 'file') {
        return false;
    }
    const target = normalisePath(uri.fsPath);
    for (const key of patchesByKustomization.keys()) {
        if (isAtOrUnder(key, target)) {
            return true;
        }
    }
    return false;
}

// Whether `candidate` is `container` itself or sits somewhere beneath it. Compared a
// segment at a time rather than as raw strings, so that /work/overlay is not taken to
// contain /work/overlay-2. Exported for testing.
export function isAtOrUnder(candidate: string, container: string): boolean {
    if (candidate === container) {
        return true;
    }
    const prefix = container.endsWith(path.sep) ? container : container + path.sep;
    return candidate.startsWith(prefix);
}

export async function initialise(context: vscode.ExtensionContext): Promise<void> {
    const watcher = vscode.workspace.createFileSystemWatcher(KUSTOMIZATION_GLOB);
    context.subscriptions.push(watcher, onDidChangeEmitter);

    watcher.onDidCreate(reindexOne, undefined, context.subscriptions);
    watcher.onDidChange(reindexOne, undefined, context.subscriptions);
    watcher.onDidDelete((uri) => {
        const key = normalisePath(uri.fsPath);
        // Take a token as well, so that a read still in flight can't resurrect the entry.
        generations.set(key, nextGeneration(key));
        patchesByKustomization.delete(key);
        republish();
    }, undefined, context.subscriptions);

    vscode.workspace.onDidChangeWorkspaceFolders(() => { rescan(); }, undefined, context.subscriptions);

    // A file-level glob never sees a kustomization disappear along with the directory it
    // lives in: VS Code reports the folder operation and not the files inside it, so
    // onDidDelete does not fire (microsoft/vscode#60813, #90746, #110923). Left alone the
    // entry stays indexed for the rest of the session, still excluding whatever now sits
    // at those paths; a rename compounds it, because the patches under the new name are
    // not indexed either and their false diagnostics come back.
    //
    // These two events cover deletes and renames made through VS Code, which is where
    // folders are usually moved about. Reconcile with a full scan, but only when the
    // operation actually reaches a kustomization we know of.
    vscode.workspace.onDidDeleteFiles((e) => {
        if (e.files.some(coversAKnownKustomization)) {
            rescan();
        }
    }, undefined, context.subscriptions);

    // Only the old side is worth testing: a rename cannot bring in a kustomization from
    // outside the workspace, so anything newly relevant was already indexed under its
    // previous path.
    vscode.workspace.onDidRenameFiles((e) => {
        if (e.files.some((file) => coversAKnownKustomization(file.oldUri))) {
            rescan();
        }
    }, undefined, context.subscriptions);

    // Awaited, unlike the rescans above: a caller has to be able to know the index is
    // populated before it decides anything about the documents already open. See the note
    // at the call site in extension.ts for why that matters.
    await rescan();
}

async function rescan(): Promise<void> {
    const generation = ++rescanGeneration;

    // What this scan is answerable for. A kustomization that first appears while we are
    // scanning belongs to the watcher, not to us: it is absent here, so the commit below
    // will not prune it on the grounds that findFiles did not see it.
    const scopeAtStart = new Set(patchesByKustomization.keys());

    const kustomizations = await vscode.workspace.findFiles(KUSTOMIZATION_GLOB);
    if (generation !== rescanGeneration) {
        return;  // another rescan started while we were walking the workspace
    }

    const found = kustomizations.map((uri) => normalisePath(uri.fsPath));
    const foundKeys = new Set(found);
    const gone = Array.from(scopeAtStart).filter((key) => !foundKeys.has(key));

    // Claim every key this scan intends to decide, before any reading starts, so that the
    // later read always wins: a single-file read beginning after this point takes a newer
    // token and the commit below stands aside for it, while one that began earlier finds
    // its token superseded and discards its own result. Pruning claims a token too --
    // without that, a read still in flight could write back an entry we are about to
    // remove.
    const claimed = new Map<string, number>();
    for (const key of [...found, ...gone]) {
        const token = nextGeneration(key);
        generations.set(key, token);
        claimed.set(key, token);
    }

    // Read into a private map: nothing reaches the index until every read is done, so a
    // scan that turns out to be stale writes nothing at all, and the index is never left
    // empty or half-populated while we work.
    const scanned = new Map<string, readonly string[]>();
    await Promise.all(kustomizations.map(async (uri) => {
        const paths = await readPatchPaths(uri);
        if (paths) {
            scanned.set(normalisePath(uri.fsPath), paths);
        }
    }));

    if (generation !== rescanGeneration) {
        return;  // superseded while we were reading; the newer scan owns the answer
    }

    // Commit synchronously, skipping anything a newer read has claimed in the meantime.
    for (const key of gone) {
        if (generations.get(key) === claimed.get(key)) {
            patchesByKustomization.delete(key);
        }
    }
    for (const key of found) {
        if (generations.get(key) !== claimed.get(key)) {
            continue;
        }
        const paths = scanned.get(key);
        if (paths) {
            patchesByKustomization.set(key, paths);
        } else {
            patchesByKustomization.delete(key);
        }
    }

    republish();
}

async function reindexOne(uri: vscode.Uri): Promise<void> {
    await indexKustomization(uri);
    republish();
}

async function indexKustomization(uri: vscode.Uri): Promise<void> {
    const key = normalisePath(uri.fsPath);
    const generation = nextGeneration(key);
    generations.set(key, generation);

    const paths = await readPatchPaths(uri);

    if (generations.get(key) !== generation) {
        return;  // superseded while we were reading
    }
    if (paths) {
        patchesByKustomization.set(key, paths);
    } else {
        patchesByKustomization.delete(key);
    }
}

// The patch paths one kustomization names, or undefined if it could not be read at all --
// unreadable, or mid-edit and not yet valid YAML. Callers drop what they knew in that
// case rather than keeping a stale answer: over-reporting warnings is better than hiding
// them.
async function readPatchPaths(uri: vscode.Uri): Promise<readonly string[] | undefined> {
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const parsed = yaml.load(Buffer.from(bytes).toString('utf8'));
        return patchFilePaths(parsed, path.dirname(uri.fsPath));
    } catch {
        return undefined;
    }
}

function nextGeneration(key: string): number {
    return (generations.get(key) ?? 0) + 1;
}

function republish(): void {
    const combined = new Set<string>();
    for (const paths of patchesByKustomization.values()) {
        for (const p of paths) {
            combined.add(p);
        }
    }

    // Editing a kustomization usually leaves the patch paths alone, and every event costs
    // consumers a schema invalidation and a re-lint, so say nothing when nothing changed.
    if (sameContents(allPatchPaths, combined)) {
        return;
    }

    allPatchPaths = combined;
    onDidChangeEmitter.fire();
}

function sameContents(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
    if (left.size !== right.size) {
        return false;
    }
    for (const item of left) {
        if (!right.has(item)) {
            return false;
        }
    }
    return true;
}

// Extracts the files a kustomization declares as patches, resolved against the directory
// containing it. Exported for testing.
//
// Only patch fields are considered. Entries under `resources` are complete objects and
// must keep their schema and lint support.
export function patchFilePaths(kustomization: unknown, containingDirectory: string): readonly string[] {
    if (!kustomization || typeof kustomization !== 'object') {
        return [];
    }

    const k = kustomization as Record<string, unknown>;
    const paths: string[] = [];

    const addFile = (entry: unknown) => {
        if (typeof entry !== 'string' || entry.length === 0) {
            return;
        }
        if (isInlinePatch(entry) || isRemoteReference(entry)) {
            return;
        }
        paths.push(normalisePath(path.resolve(containingDirectory, entry)));
    };

    // patches: entries are { path } for a file or { patch } for an inline patch.
    for (const entry of asArray(k.patches)) {
        if (entry && typeof entry === 'object') {
            addFile((entry as Record<string, unknown>).path);
        }
    }

    // patchesJson6902: deprecated, same { path } shape.
    for (const entry of asArray(k.patchesJson6902)) {
        if (entry && typeof entry === 'object') {
            addFile((entry as Record<string, unknown>).path);
        }
    }

    // patchesStrategicMerge: deprecated, entries are either a file path or inline YAML.
    for (const entry of asArray(k.patchesStrategicMerge)) {
        addFile(entry);
    }

    return paths;
}

function asArray(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : [];
}

// `patchesStrategicMerge` allows the patch body to be written inline instead of being
// pointed at. A file path never spans lines, so a newline is a reliable tell.
function isInlinePatch(entry: string): boolean {
    return entry.includes('\n');
}

// Kustomize accepts remote references in several forms. None of them name a local file.
function isRemoteReference(entry: string): boolean {
    return /^(https?:\/\/|git@|[a-z][a-z0-9+.-]*::)/i.test(entry) || entry.startsWith('github.com/');
}

// Windows paths reach us with inconsistent drive-letter casing, so compare
// case-insensitively there. Elsewhere paths are compared exactly: a case mismatch would
// break kustomize itself on a case-sensitive filesystem, so it isn't ours to paper over.
function normalisePath(fsPath: string): string {
    return process.platform === 'win32' ? fsPath.toLowerCase() : fsPath;
}
