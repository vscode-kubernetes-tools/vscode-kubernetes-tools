
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Kubectl } from '../../kubectl';

interface Recommendations {
    [crdApi: string]: string[];
}

async function recommendExtensionsToUser(tags: string[]): Promise<void> {
    if (tags.length > 0) { // do not prompt if we cannot recommend anything
        const answer = await vscode.window.showInformationMessage('Do you want to view recommended extensions for your Kubernetes cluster?', 'Ignore', 'Show Recommendation');
        if (answer === 'Show Recommendation') {
            const searchValue = tags.map((it) => `@tag:${it}`).join(' ');
            vscode.commands.executeCommand('workbench.extensions.search', searchValue);
        }
    }
}

async function getCRDApiGroups(kubectl: Kubectl): Promise<string[]> {
    const result = new Set<string>();
    const invokeResult = await kubectl.invokeCommand('get crd -o json');
    if (invokeResult.resultKind === 'exec-succeeded') {
        try {
            const res = JSON.parse(invokeResult.stdout);
            res.items.forEach((i: any) => result.add(i.spec.group));
        } catch (err) {
            // ignore
        }
    }
    return Array.from(result);
}

async function readRecommendation(extPath: string): Promise<Recommendations> {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(extPath, 'recommendation', 'recommended-extensions.json'), (err, content) => {
            if (err) {
                reject(err);
            }
            const fileContent = content.toString('utf8');
            try {
                resolve(JSON.parse(fileContent));
            } catch (error) {
                reject(error);
            }
        });
    });
}

export async function recommendExtensions(kubectl: Kubectl, context: vscode.ExtensionContext): Promise<void> {
    if (vscode.workspace.getConfiguration('extensions').get('ignoreRecommendations')) {
        return;
    }
    const crdApiGroups = await getCRDApiGroups(kubectl);

    const extensionToPromote = new Set<string>();
    const recommendation = await readRecommendation(context.extensionPath);
    // collect extension id to promote based on installed operators
    for (const crdApi of crdApiGroups) {
        for (const key in recommendation) {
            if (recommendation.hasOwnProperty(key)) {
                const value = recommendation[key];
                if (crdApi.startsWith(key)) {
                    value.forEach((val: string) => extensionToPromote.add(val));
                }
            }
        }
    }


    recommendExtensionsToUser(Array.from(extensionToPromote.values()));
}
