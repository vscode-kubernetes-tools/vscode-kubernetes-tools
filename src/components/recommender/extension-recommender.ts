
import * as vscode from 'vscode';
import * as path from 'path';
import { Kubectl } from '../../kubectl';

interface Recommendations {
    [crdApi: string]: string[];
}

async function recommendExtensionsToUser(tags: string[]): Promise<void> {
    if (tags.length > 0) { // do not prompt if we cannot recommend anything
        const answer = await vscode.window.showInformationMessage('Do you want to search for extensions based on CRDs that exist on your kubernetes cluster?', 'Don\'t ask again', 'Ignore', 'Search for Extensions');
        if (answer === 'Search for Extensions') {
            const searchValue = tags.map((it) => `@tag:${it}`).join(' ');
            vscode.commands.executeCommand('workbench.extensions.search', searchValue);
        } else if (answer === 'Don\'t ask again') {
            await vscode.workspace.getConfiguration('extensions').update('ignoreRecommendations', true);
        }
    }
}

async function getCRDApiGroups(kubectl: Kubectl): Promise<string[]> {
    const result = new Set<string>();
    const invokeResult = await kubectl.invokeCommand('api-versions');
    if (invokeResult.resultKind === 'exec-succeeded') {
        try {
            const res = invokeResult.stdout.split('\n');
            res.forEach((i: any) => result.add(i));
        } catch (err) {
            // ignore
        }
    }
    return Array.from(result);
}

async function readRecommendation(extPath: string): Promise<Recommendations> {
    const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(extPath, 'recommendation', 'recommended-tags.json')));
    return JSON.parse(Buffer.from(fileContent).toString());
}

export async function recommendExtensions(kubectl: Kubectl, context: vscode.ExtensionContext): Promise<void> {
    if (vscode.workspace.getConfiguration('extensions').get('ignoreRecommendations')) {
        return;
    }
    try {
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
    } catch (err) {

    }
}
