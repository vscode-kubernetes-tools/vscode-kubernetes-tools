import * as vscode from 'vscode';
import { fs } from '../../fs';
import * as yaml from 'js-yaml';
import { refreshExplorer } from '../clusterprovider/common/explorer';
import { getKubeconfigPath } from '../config/config';

interface Named {
    readonly name: string;
}

export async function mergeToKubeconfig(newConfigText: string): Promise<void> {
    const kcfile = getKubeconfigPath();
    if (!(await fs.existsAsync(kcfile))) {
        vscode.window.showErrorMessage("Couldn't find kubeconfig file to merge into");
        return;
    }

    const kubeconfigText = await fs.readTextFile(kcfile);
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

    const backupFile = kcfile + '.vscode-k8s-tools-backup';
    if (await fs.existsAsync(backupFile)) {
        await fs.unlinkAsync(backupFile);
    }
    await fs.renameAsync(kcfile, backupFile);
    await fs.writeTextFile(kcfile, merged);

    await refreshExplorer();
    await vscode.window.showInformationMessage(`New configuration merged to ${kcfile}`);
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
