import * as vscode from 'vscode';
import { fs } from '../../fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as shelljs from 'shelljs';
import { refreshExplorer } from '../clusterprovider/common/explorer';
import { getActiveKubeconfig, getUseWsl } from '../config/config';
import { mkdirp } from 'mkdirp';

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

export async function loadKubeconfig(): Promise<any> {
    const kubernetes = await import('@kubernetes/client-node');
    const kubeconfig = new kubernetes.KubeConfig();
    const kubeconfigPath = getKubeconfigPath();

    if (kubeconfigPath.pathType === 'host') {
        kubeconfig.loadFromFile(kubeconfigPath.hostPath);
    } else if (kubeconfigPath.pathType === 'wsl') {
        const result = shelljs.exec(`wsl.exe sh -c "cat ${kubeconfigPath.wslPath}"`, { silent: true }) as shelljs.ExecOutputReturnValue;
        if (!result) {
            throw new Error(`Impossible to retrieve the kubeconfig content from WSL at path '${kubeconfigPath.wslPath}'. No result from the shelljs.exe call.`);
        }

        if (result.code !== 0) {
            throw new Error(`Impossible to retrieve the kubeconfig content from WSL at path '${kubeconfigPath.wslPath}. Error code: ${result.code}. Error output: ${result.stderr.trim()}`);
        }

        kubeconfig.loadFromString(result.stdout.trim());
    } else {
        throw new Error(`Kubeconfig path type is not recognized.`);
    }

    return kubeconfig;
}

export function getKubeconfigPath(): KubeconfigPath {
    // If the user specified a kubeconfig path -WSL or not-, let's use it.
    let kubeconfigPath: string | undefined = getActiveKubeconfig();

    if (getUseWsl()) {
        if (!kubeconfigPath) {
            // User is using WSL: we want to use the same default that kubectl uses on Linux ($KUBECONFIG or home directory).
            const result = shelljs.exec('wsl.exe sh -c "${KUBECONFIG:-$HOME/.kube/config}"', { silent: true }) as shelljs.ExecOutputReturnValue;
            if (!result) {
                throw new Error(`Impossible to retrieve the kubeconfig path from WSL. No result from the shelljs.exe call.`);
            }

            if (result.code !== 0) {
                throw new Error(`Impossible to retrieve the kubeconfig path from WSL. Error code: ${result.code}. Error output: ${result.stderr.trim()}`);
            }
            kubeconfigPath = result.stdout.trim();
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

    const kcfile = kubeconfigPath.hostPath;
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
        if (!newEntry) continue;

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