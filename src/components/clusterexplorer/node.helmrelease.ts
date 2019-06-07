import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { ClusterExplorerNode, KubernetesExplorerNodeImpl, ClusterExplorerHelmReleaseNode } from './node';
import { getIconForHelmRelease } from './explorer';

export class HelmReleaseNode extends KubernetesExplorerNodeImpl implements ClusterExplorerHelmReleaseNode {
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
