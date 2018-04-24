import * as vscode from 'vscode';
import { fs } from './fs';
import { shell } from './shell';
import { host } from './host';
import { create as kubectlCreate, Kubectl } from './kubectl';
import { currentNamespace } from './kubectlUtils';
import { KubernetesFileObject, KubernetesExplorer } from './explorer';

export const uriScheme : string = "k8sviewfiledata";

const kubectl = kubectlCreate(host, fs, shell);

export class ConfigMapTextProvider implements vscode.TextDocumentContentProvider {
    constructor(readonly kubectl: Kubectl) {}

    provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        const parts = uri.path.split('/');
        if (uri.authority == 'configmaps') {
            return parts[1];
        } else {
            let b: Buffer = new Buffer(parts[1], 'base64');
            return b.toString();
        }
    }
}

export function loadConfigMapData(obj: KubernetesFileObject) {
    vscode.workspace.openTextDocument(
        vscode.Uri.parse(`${uriScheme}://${obj.resource}/${obj.configData[obj.id]}/${obj.id}`)).then((doc) => {
            vscode.window.showTextDocument(doc);
        });
}
