import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { ClusterExplorerNode, ClusterExplorerNodeBase, ClusterExplorerNodeImpl } from './node';
import { KubernetesExplorerNodeType } from './explorer';

export abstract class FolderNode extends ClusterExplorerNodeImpl implements ClusterExplorerNodeBase {

    constructor(readonly nodeType: KubernetesExplorerNodeType, readonly id: string, readonly displayName: string, readonly contextValue?: string) {
        super(nodeType);
    }

    abstract getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<ClusterExplorerNode[]>;

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.displayName, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = this.contextValue || `vsKubernetes.${this.id}`;
        return treeItem;
    }

    getPathApi(namespace: string): string {
        const namespaceUri = ["namespaces", "nodes"].indexOf(this.displayName.toLowerCase()) !== -1 ? "" : `namespaces/${namespace}/`;
        return `/api/v1/${namespaceUri}${this.displayName.toLowerCase()}`;
    }
}
