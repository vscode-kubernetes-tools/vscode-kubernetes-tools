import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { ClusterExplorerNode, ClusterExplorerNodeBase, ClusterExplorerNodeImpl } from './node';
import { KubernetesExplorerNodeType } from './explorer';
import { getResourceVersion } from '../../extension';

export abstract class FolderNode extends ClusterExplorerNodeImpl implements ClusterExplorerNodeBase {

    constructor(readonly nodeType: KubernetesExplorerNodeType, readonly id: string, readonly displayName: string, readonly contextValue?: string) {
        super(nodeType);
    }

    abstract getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<ClusterExplorerNode[]>;

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.displayName, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = this.contextValue || `vsKubernetes.${this.id}`;
        return treeItem;
    }

    async getPathApi(namespace: string): Promise<string> {
        const resources = this.displayName.replace(/\s/g, '').toLowerCase();
        const version = await getResourceVersion(resources);
        const baseUri = (version === 'v1') ? `/api/${version}/` : `/apis/${version}/`;
        let namespaceUri = `namespaces/${namespace}/`;
        switch (resources) {
            case "namespaces" || "nodes" || "persistentvolumes" || "storageclasses": {
                namespaceUri = '';
                break;
            }
            default: {
                break;
            }
        }
        return `${baseUri}${namespaceUri}${resources}`;
    }
}
