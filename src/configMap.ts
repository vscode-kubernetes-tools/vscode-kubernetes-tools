import * as vscode from 'vscode';
import { basename } from 'path';
import { fs } from './fs';
import { Kubectl } from './kubectl';
import * as kuberesources from './kuberesources';
import { currentNamespace, DataHolder } from './kubectlUtils';
import { deleteMessageItems, overwriteMessageItems } from './extension';
import { KubernetesExplorer } from './components/clusterexplorer/explorer';
import { allKinds } from './kuberesources';
import { ClusterExplorerConfigurationValueNode, ClusterExplorerResourceNode } from './components/clusterexplorer/node';
import { ExecResult } from './binutilplusplus';
import { getResourceFileData, replaceFromStdin } from './components/kubectl/file-commands';

export const uriScheme: string = 'k8sviewfiledata';

export class ConfigMapTextProvider implements vscode.TextDocumentContentProvider {
    constructor(readonly kubectl: Kubectl) { }

    provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<string> {
        const parts = uri.path.split('/');
        const encodedData = parts[1];
        const b: Buffer = Buffer.from(encodedData, 'hex');
        return b.toString();
    }
}

export function loadConfigMapData(obj: ClusterExplorerConfigurationValueNode) {
    const rawData = obj.configData[obj.key];
    const rawDataBuffer: Buffer = getRawData(rawData, obj.parentKind);
    const encodedData = rawDataBuffer.toString('hex');
    const uriStr = `${uriScheme}://${obj.parentKind.abbreviation}/${encodedData}/${obj.key}`;
    const uri = vscode.Uri.parse(uriStr);
    vscode.workspace.openTextDocument(uri).then(
        (doc) => {
            vscode.window.showTextDocument(doc);
        },
        (error) => {
            vscode.window.showErrorMessage('Error loading data file: ' + error);
        });
}

function getRawData(data: any, containingResourceKind: kuberesources.ResourceKind): Buffer {
    if (containingResourceKind.abbreviation === allKinds.configMap.abbreviation) {
        return Buffer.from(data);
    } else {
        return Buffer.from(data, 'base64');
    }
}

function removeKey(dictionary: any, keyToDelete: string): any {
    const newData: any = {};
    Object.keys(dictionary).forEach((key) => {
        if (key !== keyToDelete) {
            newData[key] = dictionary[key];
        }
    });
    return newData;
}

export async function deleteKubernetesConfigFile(kubectl: Kubectl, obj: ClusterExplorerConfigurationValueNode, explorer: KubernetesExplorer) {
    if (!obj) {
        return;
    }
    const result = await vscode.window.showWarningMessage(`Are you sure you want to delete ${obj.key}? This can not be undone`, ...deleteMessageItems);
    if (!result || result.title !== deleteMessageItems[0].title) {
        return;
    }
    const currentNS = await currentNamespace(kubectl);
    const getResult = await getResourceFileData(kubectl, obj.parentKind.abbreviation, obj.parentName, currentNS);
    if (ExecResult.failed(getResult)) {
        kubectl.reportFailure(getResult, { whatFailed: 'Failed to load resource data' });
        return;
    }
    const dataHolder = JSON.parse(getResult.stdout);
    dataHolder.data = removeKey(dataHolder.data, obj.key);
    const out = JSON.stringify(dataHolder);
    const er = await replaceFromStdin(kubectl, currentNS, out);
    if (ExecResult.failed(er)) {
        kubectl.reportFailure(er, { whatFailed: 'Failed to delete file' });
        return;
    }
    explorer.refresh();
    vscode.window.showInformationMessage(`Data '${obj.key}' deleted from resource.`);
}

export async function addKubernetesConfigFile(kubectl: Kubectl, obj: ClusterExplorerResourceNode, explorer: KubernetesExplorer) {
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
        const getResult = await getResourceFileData(kubectl, obj.kind.abbreviation, obj.name, currentNS);
        if (ExecResult.failed(getResult)) {
            kubectl.reportFailure(getResult, { whatFailed: `Failed to load resource ${obj.name}` });
            return;
        }
        const dataHolder = JSON.parse(getResult.stdout) as DataHolder;
        for (const uri of fileUris) {
            const filePath = uri.fsPath;
            const fileName = basename(filePath);
            if (dataHolder.data[fileName]) {
                const response = await vscode.window.showWarningMessage(`Are you sure you want to overwrite '${fileName}'? This can not be undone`, ...overwriteMessageItems);
                if (!response || response.title !== overwriteMessageItems[0].title) {
                    continue;
                }
            }
            // TODO: I really don't like sync calls here...
            const buff = fs.readFileToBufferSync(filePath);
            if (obj.kind.abbreviation === kuberesources.allKinds.configMap.abbreviation) {
                dataHolder.data[fileName] = buff.toString();
            } else {
                dataHolder.data[fileName] = buff.toString('base64');
            }
        }
        const out = JSON.stringify(dataHolder);
        const er = await replaceFromStdin(kubectl, currentNS, out);
        if (ExecResult.failed(er)) {
            kubectl.reportFailure(er, { whatFailed: `Failed to add file(s) to resource ${obj.name}` });
            return;
        }
        explorer.refresh();
        vscode.window.showInformationMessage(`New data added to resource ${obj.name}.`);
    }
}
