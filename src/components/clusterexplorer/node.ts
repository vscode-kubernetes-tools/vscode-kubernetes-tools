import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { KubernetesExplorerNodeType } from './explorer';

export interface ClusterExplorerNode {
    readonly nodeCategory: 'kubernetes-explorer-node';
    readonly nodeType: KubernetesExplorerNodeType;
    readonly id: string;
    readonly metadata?: any;
    getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<ClusterExplorerNode[]>;
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem>;
}
