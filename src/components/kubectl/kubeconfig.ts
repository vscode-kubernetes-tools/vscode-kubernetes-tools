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
    
    let fields = ['clusters', 'users', 'contexts'] as (keyof Omit<Config, "current-context">)[];
    const duplicates: Record<string, number> = {};

    // iterate over fields and check for duplicates, merging or overwriting as necessary
    for (const field of fields) {
        const newEntry = newConfig[field]?.[0];
        if (!newEntry) continue;

        const existingIndex = kubeconfig[field]?.findIndex((entry: any) => entry.name === newEntry.name);

        // If the entry already exists, ask the user if they want to overwrite it
        if (existingIndex !== undefined && existingIndex !== -1) {
            duplicates[field] = existingIndex;
            const overwrite = await vscode.window.showWarningMessage(
                `${field.slice(0, -1)} '${newEntry.name}' already exists in kubeconfig. Do you want to overwrite it?`,
                'Yes', 'No'
            );
            if (overwrite === 'No') {
                vscode.window.showInformationMessage(`Merge Cancelled.`);
                return; 
            }
        }

        const i = duplicates[field];
        const newFieldArray = newConfig[field];
        const existingFieldArray = kubeconfig[field];

        if (!newFieldArray || !newFieldArray[0]) {
            continue;
        }

        // If the entry already exists, overwrite it
        if (i !== undefined && existingFieldArray) {
            existingFieldArray[i] = newFieldArray[0];
        } else {
            // Add the new entry, with a newly created array for the kubeconfig if necessary
            if (!kubeconfig[field]) {
                kubeconfig[field] = [newFieldArray[0]];
            } else {
                kubeconfig[field]!.push(newFieldArray[0]);
            }
        }
    }

    if (!kcfileExists && newConfig.contexts && newConfig.contexts[0]) {
        kubeconfig['current-context'] = newConfig.contexts[0].name;
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