import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { ClusterExplorerNode } from './node';
import { ClusterExplorerResourceNode } from './node.resource';

export class NodeClusterExplorerNode extends ClusterExplorerResourceNode {
    constructor(name: string, meta: any) {
        super(kuberesources.allKinds.node, name, meta);
    }
    async getTreeItem(): Promise<vscode.TreeItem> {
        const treeItem = await super.getTreeItem();
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        return treeItem;
    }
    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const pods = await kubectlUtils.getPods(kubectl, null, 'all');
        const filteredPods = pods.filter((p) => `node/${p.nodeName}` === this.kindName);
        return filteredPods.map((p) => new ClusterExplorerResourceNode(kuberesources.allKinds.pod, p.name, p));
    }
}
