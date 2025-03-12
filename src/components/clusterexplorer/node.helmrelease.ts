import * as path from 'path';
import * as vscode from 'vscode';
import moment from 'moment';

import { failed } from '../../errorable';
import * as helmexec from '../../helm.exec';

import { Host } from '../../host';
import { Kubectl } from '../../kubectl';

import { NODE_TYPES } from './explorer';
import { ClusterExplorerHelmHistoryNode, ClusterExplorerHelmReleaseNode, ClusterExplorerNode, ClusterExplorerNodeImpl } from './node';
import { MessageNode } from './node.message';
import { assetUri } from '../../assets';

export class HelmHistoryNode extends ClusterExplorerNodeImpl implements ClusterExplorerHelmHistoryNode {
    constructor(readonly releaseName: string, readonly release: helmexec.HelmRelease) {
        super(NODE_TYPES.helm.history);
    }
    readonly nodeType = NODE_TYPES.helm.history;
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const updatedTime = moment(this.release.updated).fromNow();
        const treeItem = new vscode.TreeItem(`${this.release.revision}`, vscode.TreeItemCollapsibleState.None);
        treeItem.description = `${this.release.status} (${updatedTime})`;
        treeItem.command = {
            command: "extension.helmGet",
            title: "Get",
            arguments: [this]
        };
        treeItem.tooltip = `Chart version: ${this.release.chart}\nApp version: ${this.release.appVersion || "not specified in chart"}`;
        treeItem.contextValue = "vsKubernetes.helmHistory";
        return treeItem;
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [];
    }
    async apiURI(_kubectl: Kubectl, _namespace: string): Promise<string | undefined> {
        return undefined;
    }
}

export class HelmReleaseNode extends ClusterExplorerNodeImpl implements ClusterExplorerHelmReleaseNode {
    constructor(readonly releaseName: string, readonly status: string) {
        super(NODE_TYPES.helm.release);
    }
    readonly nodeType = NODE_TYPES.helm.release;
    async getChildren(_kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        if (!helmexec.ensureHelm(helmexec.EnsureMode.Silent)) {
            return [new MessageNode("Helm client is not installed")];
        }
        const history = await helmexec.helmGetHistory(this.releaseName);
        if (failed(history)) {
            return [new MessageNode("Helm history list error", history.error[0])];
        }
        return history.result.map((r) => new HelmHistoryNode(this.releaseName, r));
    }
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.releaseName, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.command = {
            command: "extension.helmGet",
            title: "Get",
            arguments: [this]
        };
        treeItem.contextValue = "vsKubernetes.helmRelease";
        treeItem.iconPath = getIconForHelmRelease(this.status.toLowerCase());
        return treeItem;
    }
    async apiURI(_kubectl: Kubectl, _namespace: string): Promise<string | undefined> {
        return undefined;
    }
}

function getIconForHelmRelease(status: string): vscode.Uri {
    if (status === "deployed") {
        return assetUri("images/helmDeployed.svg");
    }
    if (status === "superseded") {
        return assetUri("images/helmDeployed.svg");
    }
    if (status === "failed") {
        return assetUri("images/helmFailed.svg");
    }
    return vscode.Uri.file(path.join(__dirname, "../../../../images/helmDeployed.svg"));
}
