import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { ClusterExplorerNode, KubernetesExplorerNodeImpl, ClusterExplorerConfigurationValueNode } from './node';
import { ResourceKind } from '../../kuberesources';

export class ConfigurationValueNode extends KubernetesExplorerNodeImpl implements ClusterExplorerConfigurationValueNode {
    constructor(readonly configData: any, readonly key: string, readonly parentKind: ResourceKind, readonly parentName: string) {
        super("configitem");
    }
    readonly nodeType = 'configitem';
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.key, vscode.TreeItemCollapsibleState.None);
        treeItem.command = {
            command: "extension.vsKubernetesLoadConfigMapData",
            title: "Load",
            arguments: [this]
        };
        treeItem.contextValue = `vsKubernetes.file`;
        return treeItem;
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [];
    }
}
