import * as vscode from 'vscode';
import * as path from 'path';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerHelmReleaseNode } from './node';
import { NODE_TYPES } from './explorer';

export class HelmReleaseNode extends ClusterExplorerNodeImpl implements ClusterExplorerHelmReleaseNode {
    constructor(readonly releaseName: string, readonly status: string) {
        super(NODE_TYPES.helm.release);
    }
    readonly nodeType = NODE_TYPES.helm.release;
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [];
    }
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.releaseName, vscode.TreeItemCollapsibleState.None);
        treeItem.command = {
            command: "extension.helmGet",
            title: "Get",
            arguments: [this]
        };
        treeItem.contextValue = "vsKubernetes.helmRelease";
        treeItem.iconPath = getIconForHelmRelease(this.status.toLowerCase());
        return treeItem;
    }
    async getPathApi(_namespace: string): Promise<string> {
        return '';
    }
}

function getIconForHelmRelease(status: string): vscode.Uri {
    if (status === "deployed") {
        return vscode.Uri.file(path.join(__dirname, "../../../../images/helmDeployed.svg"));
    } else {
        return vscode.Uri.file(path.join(__dirname, "../../../../images/helmFailed.svg"));
    }
}
