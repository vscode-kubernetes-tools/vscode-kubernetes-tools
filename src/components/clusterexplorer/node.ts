import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { KubernetesExplorerNodeType, KUBERNETES_EXPLORER_NODE_CATEGORY } from './explorer';

export interface ClusterExplorerNode {
    readonly nodeCategory: 'kubernetes-explorer-node';
    readonly nodeType: KubernetesExplorerNodeType;
    readonly id: string;
    readonly metadata?: any;
    getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<ClusterExplorerNode[]>;
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem>;
}

export class KubernetesExplorerNodeImpl {
    readonly nodeCategory = KUBERNETES_EXPLORER_NODE_CATEGORY;
    constructor(readonly nodeType: KubernetesExplorerNodeType) {}
}
