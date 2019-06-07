import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { ClusterExplorerNode } from './node';
import { ClusterExplorerResourceNode } from './node.resource';
import { ConfigurationValueNode } from './node.configurationvalue';

export class ConfigurationResourceNode extends ClusterExplorerResourceNode {
    readonly configData: any;
    constructor(readonly kind: kuberesources.ResourceKind, readonly name: string, readonly metadata?: any, readonly data?: any) {
        super(kind, name, metadata);
        this.configData = data;
    }
    async getTreeItem(): Promise<vscode.TreeItem> {
        const treeItem = await super.getTreeItem();
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        return treeItem;
    }
    async getChildren(_kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        if (!this.configData || this.configData.length === 0) {
            return [];
        }
        const files = Object.keys(this.configData);
        return files.map((f) => new ConfigurationValueNode(this.configData, f, this.kind, this.name));
    }
}
