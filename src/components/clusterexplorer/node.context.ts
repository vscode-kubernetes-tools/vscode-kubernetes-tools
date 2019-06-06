import * as vscode from 'vscode';
import * as path from 'path';

import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import { ClusterExplorerNode, KubernetesExplorerNodeImpl } from './node';
import { KUBERNETES_CLUSTER, KubernetesNamespaceFolder, KubernetesNodeFolder, KubernetesCRDFolder, HelmReleasesFolder, MINIKUBE_CLUSTER } from './explorer';
import { WorkloadsGroupingFolderNode, NetworkGroupingFolderNode, StorageGroupingFolderNode, ConfigurationGroupingFolderNode } from "./node.folder.grouping";

export class ContextNode extends KubernetesExplorerNodeImpl implements ClusterExplorerNode {
    constructor(readonly id: string, readonly metadata: kubectlUtils.KubectlContext) {
        super('context');
    }
    get icon(): vscode.Uri {
        return vscode.Uri.file(path.join(__dirname, "../../images/k8s-logo.png"));
    }
    get clusterType(): string {
        return KUBERNETES_CLUSTER;
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        if (this.metadata.active) {
            return [
                new KubernetesNamespaceFolder(),
                new KubernetesNodeFolder(),
                new WorkloadsGroupingFolderNode(),
                new NetworkGroupingFolderNode(),
                new StorageGroupingFolderNode(),
                new ConfigurationGroupingFolderNode(),
                new KubernetesCRDFolder(),
                new HelmReleasesFolder(),
            ];
        }
        return [];
    }
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.id, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = this.clusterType;
        treeItem.iconPath = this.icon;
        if (!this.metadata || !this.metadata.active) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.contextValue += ".inactive";
        }
        if (this.metadata) {
            treeItem.tooltip = `${this.metadata.contextName}\nCluster: ${this.metadata.clusterName}`;
        }
        return treeItem;
    }
}
export class MiniKubeContextNode extends ContextNode {
    get icon(): vscode.Uri {
        return vscode.Uri.file(path.join(__dirname, "../../images/minikube-logo.png"));
    }
    get clusterType(): string {
        return MINIKUBE_CLUSTER;
    }
}
