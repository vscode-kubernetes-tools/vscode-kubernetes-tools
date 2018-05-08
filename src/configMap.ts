import * as vscode from 'vscode';
import { fs } from './fs';
import { shell } from './shell';
import { host } from './host';
import { create as kubectlCreate, Kubectl } from './kubectl';
import { currentNamespace } from './kubectlUtils';
import { KubernetesFileObject, KubernetesExplorer } from './explorer';

export const uriScheme: string = "k8sviewfiledata";

export class ConfigMapTextProvider implements vscode.TextDocumentContentProvider {
    constructor(readonly kubectl: Kubectl) {}

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
