import * as vscode from 'vscode';
import * as path from 'path';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerHelmReleaseNode } from './node';

export class HelmReleaseNode extends ClusterExplorerNodeImpl implements ClusterExplorerHelmReleaseNode {
    constructor(readonly releaseName: string, readonly status: string) {
        super("helm.release");
    }
    readonly nodeType = 'helm.release';
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
}

function getIconForHelmRelease(status: string): vscode.Uri {
    if (status === "deployed") {
        return vscode.Uri.file(path.join(__dirname, "../../images/helmDeployed.svg"));
    } else {
        return vscode.Uri.file(path.join(__dirname, "../../images/helmFailed.svg"));
    }
}
