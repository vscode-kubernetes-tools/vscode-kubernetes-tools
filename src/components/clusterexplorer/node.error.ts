import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { ClusterExplorerNode, KubernetesExplorerNodeImpl, ClusterExplorerErrorNode } from './node';

/**
 * Dummy object will be displayed as a placeholder in the tree explorer. Cannot be expanded and has no action menus on it.
 * For example, display an "Error" dummy node when failing to get children of expandable parent.
 */
export class ErrorNode extends KubernetesExplorerNodeImpl implements ClusterExplorerErrorNode {
    constructor(readonly id: string, readonly diagnostic?: string) {
        super('error');
    }
    readonly nodeType = 'error';
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.id, vscode.TreeItemCollapsibleState.None);
        if (this.diagnostic) {
            treeItem.tooltip = this.diagnostic;
        }
        return treeItem;
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [];
    }
}
