import * as vscode from 'vscode';
import * as path from 'path';

import { Kubectl } from '../../kubectl';
import * as kuberesources from '../../kuberesources';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerClusterNode } from './node';
import { ResourceFolderNode } from './node.folder.resource';
import { NODE_TYPES } from './explorer';
import { ContextNode, MiniKubeContextNode } from './node.context';

const KUBERNETES_CLUSTER = "vsKubernetes.active.cluster";

export class ClusterNode extends ClusterExplorerNodeImpl implements ClusterExplorerClusterNode {
    constructor(readonly clusterName: string, readonly kubectlContext: kubectlUtils.KubectlContext) {
        super(NODE_TYPES.cluster);
    }
    readonly nodeType = NODE_TYPES.cluster;
    get icon(): vscode.Uri {
        return vscode.Uri.file(path.join(__dirname, "../../../../images/k8s-logo.png"));
    }
    get clusterType(): string {
        return KUBERNETES_CLUSTER;
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        if (this.kubectlContext.active) {
            return [
                ((this.kubectlContext.contextName === 'minikube') ?
                        new MiniKubeContextNode(this.kubectlContext.contextName, this.kubectlContext) :
                        new ContextNode(this.kubectlContext.contextName, this.kubectlContext)),
                ResourceFolderNode.create(kuberesources.allKinds.namespace),
                ResourceFolderNode.create(kuberesources.allKinds.node)
            ];
        }
        return [];
    }
    getTreeItemInternal(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const itemName = this.kubectlContext ? this.kubectlContext.clusterName : this.clusterName;
        const treeItem = new vscode.TreeItem(itemName, vscode.TreeItemCollapsibleState.Expanded);
        treeItem.contextValue = this.clusterType;
        treeItem.iconPath = this.icon;
        if (this.kubectlContext) {
            treeItem.tooltip = `Context:${this.kubectlContext.contextName}\nUser: ${this.kubectlContext.userName}`;
        }
        return treeItem;
    }
    async apiURI(_kubectl: Kubectl, _namespace: string): Promise<string | undefined> {
        return undefined;
    }
}