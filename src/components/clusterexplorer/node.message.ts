import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerMessageNode } from './node';
import { NODE_TYPES } from './explorer';

/**
 * Dummy object will be displayed as a placeholder in the tree explorer. Cannot be expanded and has no action menus on it.
 * For example, display an "Error" dummy node when failing to get children of expandable parent.
 */
export class MessageNode extends ClusterExplorerNodeImpl implements ClusterExplorerMessageNode {
    constructor(readonly text: string, readonly diagnostic?: string) {
        super(NODE_TYPES.error);
    }
    readonly nodeType = NODE_TYPES.error;
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.text, vscode.TreeItemCollapsibleState.None);
        if (this.diagnostic) {
            treeItem.tooltip = this.diagnostic;
        }
        return treeItem;
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [];
    }
    async getPathApi(_namespace: string): Promise<string> {
        return '';
    }
}
