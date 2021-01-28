import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import * as kuberesources from '../../kuberesources';
import { Host } from '../../host';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerContextNode } from './node';
import { NODE_TYPES } from './explorer';
import { assetUri } from '../../assets';
import { ResourceFolderNode } from './node.folder.resource';
import { NamespaceNode } from './node.namespace';

const KUBERNETES_CLUSTER = "vsKubernetes.cluster";
const MINIKUBE_CLUSTER = "vsKubernetes.cluster.minikube";

export class ContextNode extends ClusterExplorerNodeImpl implements ClusterExplorerContextNode {
    constructor(readonly contextName: string, readonly kubectlContext: kubectlUtils.KubectlContext) {
        super(NODE_TYPES.context);
    }
    readonly nodeType = NODE_TYPES.context;
    get icon(): vscode.Uri {
        return assetUri("images/k8s-logo.png");
    }
    get clusterType(): string {
        return KUBERNETES_CLUSTER;
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        if (this.kubectlContext.active) {
            return [
                new NamespaceNode(this.kubectlContext.contextName, this.kubectlContext),
                ResourceFolderNode.create(kuberesources.allKinds.namespace),
                ResourceFolderNode.create(kuberesources.allKinds.node)
            ];
        }
        return [];
    }
    getBaseTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const itemName = this.kubectlContext ? this.kubectlContext.contextName : this.contextName;
        const treeItem = new vscode.TreeItem(itemName, vscode.TreeItemCollapsibleState.Expanded);
        treeItem.contextValue = this.clusterType;
        treeItem.iconPath = this.icon;
        return treeItem;
    }
    async apiURI(_kubectl: Kubectl, _namespace: string): Promise<string | undefined> {
        return undefined;
    }
}
export class MiniKubeContextNode extends ContextNode {
    get icon(): vscode.Uri {
        return assetUri("images/minikube-logo.png");
    }
    get clusterType(): string {
        return MINIKUBE_CLUSTER;
    }
}
export class InactiveContextNode extends ContextNode {
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.contextName, vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = `${this.clusterType}.inactive`;
        return treeItem;
    }
}
