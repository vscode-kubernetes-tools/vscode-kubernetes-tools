import * as vscode from 'vscode';
import { basename } from 'path';
import { fs } from './fs';
import { Kubectl } from './kubectl';
import * as kuberesources from './kuberesources';
import { currentNamespace } from './kubectlUtils';
import { deleteMessageItems, overwriteMessageItems } from './extension';
import { KubernetesExplorer } from './components/clusterexplorer/explorer';
import { allKinds } from './kuberesources';
import { failed } from './errorable';
import { ClusterExplorerConfigurationValueNode, ClusterExplorerResourceNode } from './components/clusterexplorer/node';
import { ExecResult } from './binutilplusplus';
import {
    hasValidKubernetesMetadata,
    INVALID_KUBERNETES_IDENTIFIER_MESSAGE,
    isValidConfigDataKey,
    isValidKubernetesResourceName,
    isValidKubernetesResourceType,
    isValidNamespaceName,
} from './utils/kubernetes-identifiers';

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
    if (!obj ||
        !isValidConfigDataKey(obj.key) ||
        !isValidKubernetesResourceType(obj.parentKind.abbreviation) ||
        !isValidKubernetesResourceName(obj.parentName) ||
        typeof obj.configData !== 'object' ||
        obj.configData === null ||
        !Object.keys(obj.configData).every(isValidConfigDataKey) ||
        !Object.prototype.hasOwnProperty.call(obj.configData, obj.key)) {
        vscode.window.showErrorMessage(INVALID_KUBERNETES_IDENTIFIER_MESSAGE);
        return;
    }
    const rawData = obj.configData[obj.key];
    if (typeof rawData !== 'string') {
        vscode.window.showErrorMessage(INVALID_KUBERNETES_IDENTIFIER_MESSAGE);
        return;
    }
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
    const newData: any = Object.create(null);
    Object.keys(dictionary).forEach((key) => {
        if (key !== keyToDelete) {
            Object.defineProperty(newData, key, {
                configurable: true,
                enumerable: true,
                value: dictionary[key],
                writable: true,
            });
        }
    });
    return newData;
}

export async function deleteKubernetesConfigFile(kubectl: Kubectl, obj: ClusterExplorerConfigurationValueNode, explorer: KubernetesExplorer) {
    if (!obj) {
        return;
    }
    if (!isValidConfigDataKey(obj.key) ||
        !isValidKubernetesResourceType(obj.parentKind.abbreviation) ||
        !isValidKubernetesResourceName(obj.parentName)) {
        vscode.window.showErrorMessage(INVALID_KUBERNETES_IDENTIFIER_MESSAGE);
        return;
    }
    const result = await vscode.window.showWarningMessage(`Are you sure you want to delete ${obj.key}? This can not be undone`, ...deleteMessageItems);
    if (!result || result.title !== deleteMessageItems[0].title) {
        return;
    }
    const currentNS = await currentNamespace(kubectl);
    if (!isValidNamespaceName(currentNS)) {
        vscode.window.showErrorMessage(INVALID_KUBERNETES_IDENTIFIER_MESSAGE);
        return;
    }
    const json = await kubectl.asJson<any>(['get', obj.parentKind.abbreviation, obj.parentName, `--namespace=${currentNS}`, '-o', 'json']);
    if (failed(json)) {
        return;
    }
    const dataHolder = json.result;
    const data = dataHolder ? dataHolder.data || {} : undefined;
    if (!dataHolder ||
        !hasValidKubernetesMetadata(dataHolder.metadata) ||
        dataHolder.metadata.name !== obj.parentName ||
        dataHolder.metadata.namespace !== currentNS ||
        typeof data !== 'object' ||
        data === null ||
        !Object.keys(data).every(isValidConfigDataKey)) {
        vscode.window.showErrorMessage(INVALID_KUBERNETES_IDENTIFIER_MESSAGE);
        return;
    }
    dataHolder.data = removeKey(data, obj.key);
    const out = JSON.stringify(dataHolder);
    const er = await kubectl.invokeCommand(['replace', '-f', '-', `--namespace=${currentNS}`], out);
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
    if (!isValidKubernetesResourceType(obj.kind.abbreviation) ||
        !isValidKubernetesResourceName(obj.name) ||
        (obj.namespace !== '' && !isValidNamespaceName(obj.namespace))) {
        vscode.window.showErrorMessage(INVALID_KUBERNETES_IDENTIFIER_MESSAGE);
        return;
    }
    const fileUris = await vscode.window.showOpenDialog({
        canSelectFolders: false,
        openLabel: "Add file(s)"
    } as vscode.OpenDialogOptions);
    if (fileUris) {
        console.log(fileUris);
        const currentNS = await currentNamespace(kubectl);
        if (!isValidNamespaceName(currentNS)) {
            vscode.window.showErrorMessage(INVALID_KUBERNETES_IDENTIFIER_MESSAGE);
            return;
        }
        const dataHolderJson = await kubectl.asJson<{ metadata: any; data: any }>(['get', obj.kind.abbreviation, obj.name, `--namespace=${currentNS}`, '-o', 'json']);
        if (failed(dataHolderJson)) {
            return;
        }
        const dataHolder = dataHolderJson.result;
        const data = dataHolder ? dataHolder.data || Object.create(null) : undefined;
        if (!dataHolder ||
            !hasValidKubernetesMetadata(dataHolder.metadata) ||
            dataHolder.metadata.name !== obj.name ||
            dataHolder.metadata.namespace !== currentNS ||
            typeof data !== 'object' ||
            data === null ||
            !Object.keys(data).every(isValidConfigDataKey)) {
            vscode.window.showErrorMessage(INVALID_KUBERNETES_IDENTIFIER_MESSAGE);
            return;
        }
        dataHolder.data = data;
        for (const uri of fileUris) {
            const filePath = uri.fsPath;
            const fileName = basename(filePath);
            if (!isValidConfigDataKey(fileName)) {
                vscode.window.showErrorMessage('The selected file name is not a valid Kubernetes configuration data key.');
                return;
            }
            if (Object.prototype.hasOwnProperty.call(dataHolder.data, fileName)) {
                const response = await vscode.window.showWarningMessage(`Are you sure you want to overwrite '${fileName}'? This can not be undone`, ...overwriteMessageItems);
                if (!response || response.title !== overwriteMessageItems[0].title) {
                    continue;
                }
            }
            // TODO: I really don't like sync calls here...
            const buff = fs.readFileToBufferSync(filePath);
            if (obj.kind.abbreviation === kuberesources.allKinds.configMap.abbreviation) {
                Object.defineProperty(dataHolder.data, fileName, {
                    configurable: true,
                    enumerable: true,
                    value: buff.toString(),
                    writable: true,
                });
            } else {
                Object.defineProperty(dataHolder.data, fileName, {
                    configurable: true,
                    enumerable: true,
                    value: buff.toString('base64'),
                    writable: true,
                });
            }
        }
        const out = JSON.stringify(dataHolder);
        const er = await kubectl.invokeCommand(['replace', '-f', '-', `--namespace=${currentNS}`], out);
        if (ExecResult.failed(er)) {
            kubectl.reportFailure(er, { whatFailed: `Failed to add file(s) to resource ${obj.name}` });
            return;
        }
        explorer.refresh();
        vscode.window.showInformationMessage(`New data added to resource ${obj.name}.`);
    }
}
