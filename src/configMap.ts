import * as vscode from 'vscode';
import { fs } from './fs';
import { shell } from './shell';
import { host } from './host';
import { create as kubectlCreate, Kubectl } from './kubectl';
import { currentNamespace } from './kubectlUtils';
import { KubernetesFileObject, KubernetesExplorer } from './explorer';

export const uriScheme: string = "k8sviewfiledata";

export class ConfigMapTextProvider implements vscode.TextDocumentContentProvider {
    constructor(readonly kubectl: Kubectl) { }

    provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        const parts = uri.path.split('/');
        const b: Buffer = new Buffer(parts[1], 'base64');
        return b.toString();
    }
}

export function loadConfigMapData(obj: KubernetesFileObject) {
    let encoded_data = obj.configData[obj.id];
    if (obj.resource == 'configmaps') {
        encoded_data = Buffer.from(obj.configData[obj.id]).toString('base64');
    }
    const uri_str = `${uriScheme}://${obj.resource}/${encoded_data}/${obj.id}`;
    const uri = vscode.Uri.parse(uri_str);
    vscode.workspace.openTextDocument(uri).then(
        (doc) => {
            vscode.window.showTextDocument(doc);
        },
        (error) => {
            vscode.window.showErrorMessage('Error loading data file: ' + error);
        });
}

export async function deleteKubernetesConfigFile(kubectl: Kubectl, obj: KubernetesFileObject, explorer: KubernetesExplorer) {
    const confirm = 'Delete';
    let result = await vscode.window.showWarningMessage(`Are you sure you want to delete ${obj.id} this can not be undone`, confirm, 'Cancel');
    console.log(confirm);
    if (result !== confirm) {
        return;
    }
    const currentNS = await currentNamespace(kubectl);
    const json = await kubectl.invokeAsync(`get ${obj.resource} ${obj.parentName} --namespace=${currentNS} -o json`);
    const dataHolder = JSON.parse(json.stdout);
    let newData = {};
    Object.keys(dataHolder.data).forEach((key) => {
        if (key !== obj.id) {
            newData[key] = dataHolder.data[key];
        }
    });
    dataHolder.data = newData;
    const out = JSON.stringify(dataHolder);
    const shellRes = await kubectl.invokeAsync(`replace -f - --namespace=${currentNS}`, out);
    if (shellRes.code !== 0) {
        vscode.window.showErrorMessage('Failed to delete file: ' + shellRes.stderr);
    }
    explorer.refresh();
    vscode.window.showInformationMessage(`Data '${obj.id}' deleted from resource.`);
}
}