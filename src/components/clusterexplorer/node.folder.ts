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

    getTreeItemInternal(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.displayName, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = this.contextValue || `vsKubernetes.${this.id}`;
        return treeItem;
    }

    async apiURI(_kubectl: Kubectl, _namespace: string): Promise<string | undefined> {
        return undefined;
    }
}
