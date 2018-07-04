import * as vscode from 'vscode';
import { basename } from 'path';
import { fs } from './fs';
import { Kubectl } from './kubectl';
import { currentNamespace, DataHolder } from './kubectlUtils';
import { deleteMessageItems, overwriteMessageItems } from './extension';
import { KubernetesFileObject, KubernetesDataHolderResource, KubernetesExplorer } from './explorer';
import { allKinds } from './kuberesources';
import { failed } from './errorable';

export const uriScheme: string = 'k8sviewfiledata';

export class ConfigMapTextProvider implements vscode.TextDocumentContentProvider {
    constructor(readonly kubectl: Kubectl) { }

    provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        const parts = uri.path.split('/');
        const b: Buffer = new Buffer(parts[1], 'base64');
        return b.toString();
    }
}

export function loadConfigMapData(obj: KubernetesFileObject) {
    let encodedData = obj.configData[obj.id];
    if (obj.resource === allKinds.configMap.abbreviation) {
        encodedData = Buffer.from(obj.configData[obj.id]).toString('base64');
    }
    const uriStr = `${uriScheme}://${obj.resource}/${encodedData}/${obj.id}`;
    const uri = vscode.Uri.parse(uriStr);
    vscode.workspace.openTextDocument(uri).then(
        (doc) => {
            vscode.window.showTextDocument(doc);
        },
        (error) => {
            vscode.window.showErrorMessage('Error loading data file: ' + error);
        });
}

function removeKey(dictionary: any, keyToDelete: string) {
    const newData = {};
    Object.keys(dictionary).forEach((key) => {
        if (key !== keyToDelete) {
            newData[key] = dictionary[key];
        }
    });
    return newData;
}

export async function deleteKubernetesConfigFile(kubectl: Kubectl, obj: KubernetesFileObject, explorer: KubernetesExplorer) {
    if (!obj) {
        return;
    }
    const result = await vscode.window.showWarningMessage(`Are you sure you want to delete ${obj.id}? This can not be undone`, ...deleteMessageItems);
    if (result.title !== deleteMessageItems[0].title) {
        return;
    }
    const currentNS = await currentNamespace(kubectl);
    const json = await kubectl.asJson<any>(`get ${obj.resource} ${obj.parentName} --namespace=${currentNS} -o json`);
    if (failed(json)) {
        return;
    }
    const dataHolder = json.result;
    dataHolder.data = removeKey(dataHolder.data, obj.id);
    const out = JSON.stringify(dataHolder);
    const shellRes = await kubectl.invokeAsync(`replace -f - --namespace=${currentNS}`, out);
    if (shellRes.code !== 0) {
        vscode.window.showErrorMessage('Failed to delete file: ' + shellRes.stderr);
        return;
    }
    explorer.refresh();
    vscode.window.showInformationMessage(`Data '${obj.id}' deleted from resource.`);
}

export async function addKubernetesConfigFile(kubectl: Kubectl, obj: KubernetesDataHolderResource, explorer: KubernetesExplorer) {
    if (!obj) {
        return;
    }
    const fileUris = await vscode.window.showOpenDialog({
        canSelectFolders: false,
        openLabel: "Add file(s)"
    } as vscode.OpenDialogOptions);
    if (fileUris) {
        console.log(fileUris);
        const currentNS = await currentNamespace(kubectl);
        const dataHolderJson = await kubectl.asJson<DataHolder>(`get ${obj.resource} ${obj.id} --namespace=${currentNS} -o json`);
        if (failed(dataHolderJson)) {
            return;
        }
        const dataHolder = dataHolderJson.result;
        fileUris.map(async (uri) => {
            const filePath = uri.fsPath;
            const fileName = basename(filePath);
            if (dataHolder.data[fileName]) {
                const response = await vscode.window.showWarningMessage(`Are you sure you want to overwrite '${fileName}'? This can not be undone`, ...overwriteMessageItems);
                if (response.title !== overwriteMessageItems[0].title) {
                    return;
                }
            }
            // TODO: I really don't like sync calls here...
            const buff = fs.readFileToBufferSync(filePath);
            if (obj.resource === 'configmap') {
                dataHolder.data[fileName] = buff.toString();
            } else {
                dataHolder.data[fileName] = buff.toString('base64');
            }
        });
        const out = JSON.stringify(dataHolder);
        const shellRes = await kubectl.invokeAsync(`replace -f - --namespace=${currentNS}`, out);
        if (shellRes.code !== 0) {
            vscode.window.showErrorMessage('Failed to add file(s) to resource ${obj.id}: ' + shellRes.stderr);
            return;
        }
        explorer.refresh();
        vscode.window.showInformationMessage(`New data added to resource ${obj.id}.`);
    }
}
