import * as vscode from 'vscode';
import * as path from 'path';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerHelmReleaseNode } from './node';
import { NODE_TYPES } from './explorer';
import * as helmexec from '../../helm.exec';
import { MessageNode } from './node.message';
import { failed } from '../../errorable';

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
        return history.result.map((r) => new HelmReleaseNode(`${r.revision}`, r.status));

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
    async apiURI(_kubectl: Kubectl, _namespace: string): Promise<string | undefined> {
        return undefined;
    }
}

function getIconForHelmRelease(status: string): vscode.Uri {
    if (status === "deployed") {
        return vscode.Uri.file(path.join(__dirname, "../../../../images/helmDeployed.svg"));
    } else {
        return vscode.Uri.file(path.join(__dirname, "../../../../images/helmFailed.svg"));
    }
}
