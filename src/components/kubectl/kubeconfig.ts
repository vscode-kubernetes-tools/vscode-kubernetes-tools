import * as vscode from 'vscode';
import { fs } from '../../fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as nativeFs from 'fs';
import { execWslSync } from '../../wsl';
import { refreshExplorer } from '../clusterprovider/common/explorer';
import { getActiveKubeconfig, getUseWsl } from '../config/config';
import { mkdirp } from 'mkdirp';
import type { KubeConfig } from '@kubernetes/client-node';

interface Named {
    readonly name: string;
}

interface Config {
    clusters?: Named[];
    contexts?: Named[];
    users?: Named[];
    "current-context"?: string;
}

export interface HostKubeconfigPath {
    readonly pathType: 'host';
    readonly hostPath: string;
}

export interface WSLKubeconfigPath {
    readonly pathType: 'wsl';
    readonly wslPath: string;
}

export type KubeconfigPath = HostKubeconfigPath | WSLKubeconfigPath;

export interface KubeconfigSelection {
    readonly kubeconfig?: string;
    readonly context?: string;
}

export interface KubeconfigSource {
    readonly file: string;
    readonly contents: string;
}

export interface KubeconfigEntry {
    readonly name: string;
    readonly value: Record<string, unknown>;
    readonly file: string;
}

export interface KubeconfigSnapshot {
    readonly path: KubeconfigPath;
    readonly documents: readonly { readonly source: KubeconfigSource; readonly document: Record<string, unknown> }[];
    readonly currentContext: string | undefined;
    readonly clusters: readonly KubeconfigEntry[];
    readonly contexts: readonly KubeconfigEntry[];
    readonly users: readonly KubeconfigEntry[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function getKubeconfigFiles(kubeconfigPath: KubeconfigPath): string[] {
    const files = kubeconfigPath.pathType === 'host' ? kubeconfigPath.hostPath : kubeconfigPath.wslPath;
    return files.split(kubeconfigPath.pathType === 'host' ? path.delimiter : ':').filter((file) => file.length > 0);
}

export async function readKubeconfigSources(kubeconfigPath: KubeconfigPath): Promise<readonly KubeconfigSource[]> {
    const files = getKubeconfigFiles(kubeconfigPath);
    if (files.length === 0) {
        throw new Error('No kubeconfig paths specified');
    }
    const sources: KubeconfigSource[] = [];
    for (const selectedFile of new Set(files)) {
        const file = kubeconfigPath.pathType === 'host' ? path.resolve(vscode.workspace.rootPath ?? process.cwd(), selectedFile) : selectedFile;
        try {
            let contents: string;
            if (kubeconfigPath.pathType === 'host') {
                contents = nativeFs.readFileSync(file, 'utf8');
            } else {
                const result = execWslSync(['env', 'LC_ALL=C', 'cat', '--', file]);
                if (result.code !== 0) {
                    if (result.code === 1 && result.stderr.trimEnd().endsWith(': No such file or directory')) { continue; }
                    throw new Error(`Error code: ${result.code}. Error output: ${result.stderr.trim()}`);
                }
                contents = result.stdout;
            }
            if (contents.trim()) {
                sources.push({ file, contents });
            }
        } catch (error) {
            if (kubeconfigPath.pathType === 'host' && (error as NodeJS.ErrnoException).code === 'ENOENT') { continue; }
            throw new Error(`Unable to load kubeconfig at path '${file}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return sources;
}

export async function readKubeconfigSnapshot(
    kubeconfigPath = getKubeconfigPath(),
    sources?: readonly KubeconfigSource[]
): Promise<KubeconfigSnapshot> {
    const documents = (sources ?? await readKubeconfigSources(kubeconfigPath)).flatMap((source) => {
        const document: unknown = yaml.load(source.contents);
        if (document === undefined || document === null) { return []; }
        if (!isRecord(document)) {
            throw new Error('The Kubernetes configuration is invalid.');
        }
        return [{ source, document }];
    });
    const entries = (field: 'clusters' | 'contexts' | 'users', key: 'cluster' | 'context' | 'user'): KubeconfigEntry[] => {
        const merged = new Map<string, KubeconfigEntry>();
        for (const { source, document } of documents) {
            const values = document[field];
            if (values === undefined || values === null) { continue; }
            if (!Array.isArray(values)) { throw new Error('The Kubernetes configuration is invalid.'); }
            for (const entry of values) {
                if (!isRecord(entry) || typeof entry.name !== 'string') {
                    throw new Error('The Kubernetes configuration is invalid.');
                }
                const value = entry[key];
                if (value !== undefined && value !== null && !isRecord(value)) {
                    throw new Error('The Kubernetes configuration is invalid.');
                }
                if (!merged.has(entry.name)) {
                    merged.set(entry.name, { name: entry.name, value: value ?? {}, file: source.file });
                }
            }
        }
        return [...merged.values()];
    };
    const currentContext = documents.map(({ document }) => document['current-context'])
        .find((name): name is string => typeof name === 'string' && name.length > 0);
    return {
        path: kubeconfigPath, documents, currentContext,
        clusters: entries('clusters', 'cluster'), contexts: entries('contexts', 'context'), users: entries('users', 'user'),
    };
}

export async function loadKubeconfig(
    kubeconfigPath = getKubeconfigPath(),
    sources?: readonly KubeconfigSource[]
): Promise<KubeConfig> {
    const kubernetes = await import('@kubernetes/client-node');
    const kubeconfig = new kubernetes.KubeConfig();
    let currentContext: string | undefined;
    for (const { file, contents } of sources ?? await readKubeconfigSources(kubeconfigPath)) {
        const source = new kubernetes.KubeConfig();
        try {
            const document = yaml.load(contents);
            if (document === undefined || document === null) { continue; }
            source.loadFromString(contents);
            if (kubeconfigPath.pathType === 'host') {
                source.makePathsAbsolute(path.dirname(file));
            }
        } catch (error) {
            throw new Error(`Unable to load kubeconfig at path '${file}': ${error instanceof Error ? error.message : String(error)}`);
        }
        for (const cluster of source.getClusters()) {
            if (!kubeconfig.getCluster(cluster.name)) { kubeconfig.addCluster(cluster); }
        }
        for (const user of source.getUsers()) {
            if (!kubeconfig.getUser(user.name)) { kubeconfig.addUser(user); }
        }
        for (const context of source.getContexts()) {
            if (!kubeconfig.getContextObject(context.name)) { kubeconfig.addContext(context); }
        }
        currentContext ||= source.getCurrentContext();
    }
    if (currentContext) {
        kubeconfig.setCurrentContext(currentContext);
    }

    return kubeconfig;
}

export function getKubeconfigPath(): KubeconfigPath {
    // If the user specified a kubeconfig path -WSL or not-, let's use it.
    let kubeconfigPath: string | undefined = getActiveKubeconfig();

    if (getUseWsl()) {
        if (!kubeconfigPath) {
            // User is using WSL: we want to use the same default that kubectl uses on Linux ($KUBECONFIG or home directory).
            // Fixed script expands guest variables without evaluating their contents.
            const result = execWslSync(['sh', '-c', 'printf "%s" "${KUBECONFIG:-$HOME/.kube/config}"']);
            if (result.code !== 0) {
                throw new Error(`Impossible to retrieve the kubeconfig path from WSL. Error code: ${result.code}. Error output: ${result.stderr.trim()}`);
            }
            kubeconfigPath = result.stdout;
        }
        return {
            pathType: 'wsl',
            wslPath: kubeconfigPath
        };
    }

    if (!kubeconfigPath) {
        kubeconfigPath = process.env['KUBECONFIG'];
    }
    if (!kubeconfigPath) {
        // Fall back on the default kubeconfig value.
        kubeconfigPath = path.join((process.env['HOME'] || process.env['USERPROFILE'] || '.'), ".kube", "config");
    }
    return {
        pathType: 'host',
        hostPath: kubeconfigPath
    };
}

export async function mergeToKubeconfig(newConfigText: string): Promise<void> {
    const kubeconfigPath = getKubeconfigPath();

    if (kubeconfigPath.pathType === 'wsl') {
        vscode.window.showErrorMessage("You are on Windows, but are using WSL-based tools. We can't merge into your WSL kubeconfig. Consider running VS Code in WSL using the Remote Extensions.");
        return;
    }

    // For multi-path KUBECONFIG, use the first path (where new config should be merged)
    const kcfile = kubeconfigPath.hostPath.split(path.delimiter)[0];
    const kcfileExists = await fs.existsAsync(kcfile);

    const kubeconfigText = kcfileExists ? await fs.readTextFile(kcfile) : '';
    const kubeconfig = (yaml.load(kubeconfigText) || {}) as Config;
    const newConfig = yaml.load(newConfigText) as Config;

    // null checks
    if (!kubeconfig || !newConfig) {
        vscode.window.showErrorMessage("Error fetching kubeconfig.");
        return;
    }

    // Check for duplicate cluster / user / context names
    const newCluster = newConfig.clusters?.[0];
    const newUser = newConfig.users?.[0];
    const newContext = newConfig.contexts?.[0];

    const clusterExists = newCluster && kubeconfig.clusters?.some((c) => c.name === newCluster.name);
    const userExists = newUser && kubeconfig.users?.some((u) => u.name === newUser.name);
    const contextExists = newContext && kubeconfig.contexts?.some((c) => c.name === newContext.name);

    const hasDuplicates = clusterExists || userExists || contextExists;

    let renameWithSuffix = false;

    // Prompt user if duplicates are found
    if (hasDuplicates) {
        const duplicateNames = [
            clusterExists ? `cluster '${newCluster?.name}'` : null,
            userExists ? `user '${newUser?.name}'` : null,
            contextExists ? `context '${newContext?.name}'` : null
        ].filter(Boolean).join(', ');

        const choice = await vscode.window.showWarningMessage(
            `${duplicateNames} already exist in kubeconfig. What would you like to do?`,
            'Overwrite', 'Keep Both', 'Cancel'
        );

        if (choice === 'Cancel' || !choice) {
            vscode.window.showInformationMessage('Merge cancelled.');
            return;
        }
        renameWithSuffix = choice === 'Keep Both';
    }

    // Apply suffix to new entry names if keeping both
    if (renameWithSuffix && newCluster && newUser && newContext) {
        // Helper to find next available counter (2, 3, 4, ...)
        const findNextCounter = (baseName: string) => {
            let counter = 2;
            while (kubeconfig.clusters?.some((c) => c.name === `${baseName} (${counter})`)) {
                counter++;
            }
            return counter;
        };

        let suffix: string;
        // Extract suffix from AKS user name pattern: clusterUser_resourceGroup_clusterName -> resourceGroup
        const match = newUser.name.match(/^clusterUser_([^_]+)_/);
        if (match) {
            const baseSuffix = match[1];
            const candidateName = `${newCluster.name} (${baseSuffix})`;
            // If name with same resource group suffix exists, add a counter
            suffix = kubeconfig.clusters?.some((c) => c.name === candidateName)
                ? ` (${baseSuffix}) (${findNextCounter(candidateName)})`
                : ` (${baseSuffix})`;
        } else {
            // Non-AKS: just add counter
            suffix = ` (${findNextCounter(newCluster.name)})`;
        }

        (newCluster as any).name += suffix;
        (newUser as any).name += suffix;
        (newContext as any).name += suffix;
        // Update context references to renamed cluster & user
        const ctx = (newContext as any).context;
        if (ctx) {
            ctx.cluster = newCluster.name;
            ctx.user = newUser.name;
        }
    }

    // Merge entries
    const fields = ['clusters', 'users', 'contexts'] as (keyof Omit<Config, "current-context">)[];
    for (const field of fields) {
        const newEntry = newConfig[field]?.[0];
        if (!newEntry) {
            continue;
        }

        const arr = kubeconfig[field] ??= [];
        const existingIndex = arr.findIndex((entry: any) => entry.name === newEntry.name);
        if (existingIndex >= 0) {
            arr[existingIndex] = newEntry;
        } else {
            arr.push(newEntry);
        }
    }

    if (!kcfileExists && newContext) {
        kubeconfig['current-context'] = newContext.name;
    }

    const merged = yaml.dump(kubeconfig, { lineWidth: 1000000, noArrayIndent: true });

    if (kcfileExists) {
        const backupFile = kcfile + '.vscode-k8s-tools-backup';
        if (await fs.existsAsync(backupFile)) {
            await fs.unlinkAsync(backupFile);
        }
        await fs.renameAsync(kcfile, backupFile);
    } else {
        await mkdirp(path.dirname(kcfile));
    }
    await fs.writeTextFile(kcfile, merged);

    await refreshExplorer();
    await vscode.window.showInformationMessage(`New configuration merged to ${kcfile}`);
}
