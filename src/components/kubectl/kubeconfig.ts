import * as vscode from 'vscode';
import { fs } from '../../fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as shelljs from 'shelljs';
import { ConfigurationV1 } from '../../api/contract/configuration/v1';
import { refreshExplorer } from '../clusterprovider/common/explorer';
import { getActiveKubeconfig, getUseWsl } from '../config/config';

interface Named {
    readonly name: string;
}

export function getKubeconfigPath(): ConfigurationV1.KubeconfigPath  {
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
    const kubeconfigFilePath = kubeconfigPath.pathType === "host" ? kubeconfigPath.hostPath : kubeconfigPath.wslPath;
    if (!(await fs.existsAsync(kubeconfigFilePath))) {
        vscode.window.showErrorMessage(`Couldn't find kubeconfig file to merge into: '${kubeconfigFilePath}'`);
        return;
    }

    const kubeconfigText = await fs.readTextFile(kubeconfigFilePath);
    const kubeconfig = yaml.safeLoad(kubeconfigText);
    const newConfig = yaml.safeLoad(newConfigText);

    for (const section of ['clusters', 'contexts', 'users']) {
        const existing: Named[] | undefined = kubeconfig[section];
        const toMerge: Named[] | undefined = newConfig[section];
        if (!toMerge) {
            continue;
        }
        if (!existing) {
            kubeconfig[section] = toMerge;
            continue;
        }
        await mergeInto(existing, toMerge);
    }

    const merged = yaml.safeDump(kubeconfig, { lineWidth: 1000000, noArrayIndent: true });

    const backupFile = kubeconfigFilePath + '.vscode-k8s-tools-backup';
    if (await fs.existsAsync(backupFile)) {
        await fs.unlinkAsync(backupFile);
    }
    await fs.renameAsync(kubeconfigFilePath, backupFile);
    await fs.writeTextFile(kubeconfigFilePath, merged);

    await refreshExplorer();
    await vscode.window.showInformationMessage(`New configuration merged to ${kubeconfigFilePath}`);
}

async function mergeInto(existing: Named[], toMerge: Named[]): Promise<void> {
    for (const toMergeEntry of toMerge) {
        if (existing.some((e) => e.name === toMergeEntry.name)) {
            // we have CONFLICT and CONFLICT BUILDS CHARACTER
            await vscode.window.showWarningMessage(`${toMergeEntry.name} already exists - skipping`);
            continue;  // TODO: build character
        }
        existing.push(toMergeEntry);
    }
}
