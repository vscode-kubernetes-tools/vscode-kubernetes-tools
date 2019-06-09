import * as vscode from 'vscode';
import * as path from 'path';

import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerContextNode } from './node';
import { NamespacesFolder } from "./node.folder.namespaces";
import { NodesFolder } from "./node.folder.nodes";
import { HelmReleasesFolder } from "./node.folder.helmreleases";
import { CRDTypesFolderNode } from "./node.folder.crdtypes";
import { WorkloadsGroupingFolderNode, NetworkGroupingFolderNode, StorageGroupingFolderNode, ConfigurationGroupingFolderNode } from "./node.folder.grouping";

const KUBERNETES_CLUSTER = "vsKubernetes.cluster";
const MINIKUBE_CLUSTER = "vsKubernetes.minikubeCluster";

export class ContextNode extends ClusterExplorerNodeImpl implements ClusterExplorerContextNode {
    constructor(readonly contextName: string, readonly kubectlContext: kubectlUtils.KubectlContext) {
        super('context');
    }
    readonly nodeType = 'context';
    get icon(): vscode.Uri {
        return vscode.Uri.file(path.join(__dirname, "../../../../images/k8s-logo.png"));
    }
    get clusterType(): string {
        return KUBERNETES_CLUSTER;
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        if (this.kubectlContext.active) {
            return [
                new NamespacesFolder(),
                new NodesFolder(),
                new WorkloadsGroupingFolderNode(),
                new NetworkGroupingFolderNode(),
                new StorageGroupingFolderNode(),
                new ConfigurationGroupingFolderNode(),
                new CRDTypesFolderNode(),
                new HelmReleasesFolder(),
            ];
        }
        return [];
    }
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.contextName, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = this.clusterType;
        treeItem.iconPath = this.icon;
        if (!this.kubectlContext || !this.kubectlContext.active) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.contextValue += ".inactive";
        }
        if (this.kubectlContext) {
            treeItem.tooltip = `${this.kubectlContext.contextName}\nCluster: ${this.kubectlContext.clusterName}`;
        }
        return treeItem;
    }
}
export class MiniKubeContextNode extends ContextNode {
    get icon(): vscode.Uri {
        return vscode.Uri.file(path.join(__dirname, "../../../../images/minikube-logo.png"));
    }
    get clusterType(): string {
        return MINIKUBE_CLUSTER;
    }
}