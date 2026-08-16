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

const KUSTOMIZATION_GLOB = '**/[kK]ustomization.{yaml,yml}';

// Patch paths keyed by the kustomization that declared them, so that editing one
// kustomization only re-indexes that file.
const patchesByKustomization = new Map<string, readonly string[]>();

let allPatchPaths = new Set<string>();

const onDidChangeEmitter = new vscode.EventEmitter<void>();

// Fires when the set of known patch files changes - on the initial scan and whenever a
// kustomization is created, edited or deleted. Consumers should re-evaluate any documents
// they have already processed.
export const onDidChange = onDidChangeEmitter.event;

export function isKustomizePatch(uri: vscode.Uri): boolean {
    if (uri.scheme !== 'file') {
        return false;
    }
    return allPatchPaths.has(normalisePath(uri.fsPath));
}

export function initialise(context: vscode.ExtensionContext): void {
    const watcher = vscode.workspace.createFileSystemWatcher(KUSTOMIZATION_GLOB);
    context.subscriptions.push(watcher, onDidChangeEmitter);

    watcher.onDidCreate(reindexOne, undefined, context.subscriptions);
    watcher.onDidChange(reindexOne, undefined, context.subscriptions);
    watcher.onDidDelete((uri) => {
        patchesByKustomization.delete(normalisePath(uri.fsPath));
        republish();
    }, undefined, context.subscriptions);

    vscode.workspace.onDidChangeWorkspaceFolders(() => { rescan(); }, undefined, context.subscriptions);

    // Deliberately not awaited: activation shouldn't block on walking the workspace. Until
    // the scan lands nothing is excluded, and the onDidChange event tells consumers to
    // reconsider once it does.
    rescan();
}

async function rescan(): Promise<void> {
    const kustomizations = await vscode.workspace.findFiles(KUSTOMIZATION_GLOB);
    patchesByKustomization.clear();
    await Promise.all(kustomizations.map(indexKustomization));
    republish();
}

async function reindexOne(uri: vscode.Uri): Promise<void> {
    await indexKustomization(uri);
    republish();
}

async function indexKustomization(uri: vscode.Uri): Promise<void> {
    const key = normalisePath(uri.fsPath);
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const parsed = yaml.load(Buffer.from(bytes).toString('utf8'));
        patchesByKustomization.set(key, patchFilePaths(parsed, path.dirname(uri.fsPath)));
    } catch {
        // Unreadable or mid-edit and not yet valid YAML. Drop what we knew rather than
        // keeping a stale answer: over-reporting warnings is better than hiding them.
        patchesByKustomization.delete(key);
    }
}

function republish(): void {
    const combined = new Set<string>();
    for (const paths of patchesByKustomization.values()) {
        for (const p of paths) {
            combined.add(p);
        }
    }
    allPatchPaths = combined;
    onDidChangeEmitter.fire();
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
