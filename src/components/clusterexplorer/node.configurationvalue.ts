import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerConfigurationValueNode } from './node';
import { ResourceKind } from '../../kuberesources';
import { NODE_TYPES } from './explorer';

export class ConfigurationValueNode extends ClusterExplorerNodeImpl implements ClusterExplorerConfigurationValueNode {
    constructor(readonly configData: any, readonly key: string, readonly parentKind: ResourceKind, readonly parentName: string) {
        super(NODE_TYPES.configitem);
    }
    readonly nodeType = NODE_TYPES.configitem;
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
    getPathApi(_namespace: string): string {
        return ''; //todo ma che so??
    }
}
