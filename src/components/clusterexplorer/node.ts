import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { KubernetesExplorerNodeType, KUBERNETES_EXPLORER_NODE_CATEGORY } from './explorer';
import { KubectlContext } from '../../kubectlUtils';
import { ResourceKind } from '../../kuberesources';

export interface ClusterExplorerNodeBase {
    readonly nodeCategory: 'kubernetes-explorer-node';
    // readonly nodeType: KubernetesExplorerNodeType;
    // readonly id: string;
    // readonly metadata?: any;
    getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<ClusterExplorerNode[]>;
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem>;
}

export interface ClusterExplorerContextNode extends ClusterExplorerNodeBase {
    readonly nodeType: 'context';
    readonly kubectlContext: KubectlContext;
    readonly contextName: string;
}

export interface ClusterExplorerResourceFolderNode extends ClusterExplorerNodeBase {
    readonly nodeType: 'folder.resource';
    readonly kind: ResourceKind;
}

export interface ClusterExplorerGroupingFolderNode extends ClusterExplorerNodeBase {
    readonly nodeType: 'folder.grouping';
}

export interface ClusterExplorerErrorNode extends ClusterExplorerNodeBase {
    readonly nodeType: 'error';
}

export interface ClusterExplorerResourceNode extends ClusterExplorerNodeBase {
    readonly nodeType: 'resource';
    readonly name: string;
    readonly namespace: string | null;
    readonly kindName: string;
    readonly metadata?: any;
    readonly kind: ResourceKind;
    uri(outputFormat: string): vscode.Uri;
}

export interface ClusterExplorerConfigurationValueNode extends ClusterExplorerNodeBase {
    readonly nodeType: 'configitem';
    readonly key: string;
    readonly configData: any;
    readonly parentKind: ResourceKind;
    readonly parentName: string;
}

export interface ClusterExplorerHelmReleaseNode extends ClusterExplorerNodeBase {
    readonly nodeType: 'helm.release';
    readonly releaseName: string;
}

export interface ClusterExplorerCustomNode extends ClusterExplorerNodeBase {
    readonly nodeType: 'extension';
}

export type ClusterExplorerNode =
    ClusterExplorerErrorNode |
    ClusterExplorerContextNode |
    ClusterExplorerResourceFolderNode |
    ClusterExplorerGroupingFolderNode |
    ClusterExplorerResourceNode |
    ClusterExplorerConfigurationValueNode |
    ClusterExplorerHelmReleaseNode |
    ClusterExplorerCustomNode;

export class ClusterExplorerNodeImpl {
    readonly nodeCategory = KUBERNETES_EXPLORER_NODE_CATEGORY;
    constructor(readonly nodeType: KubernetesExplorerNodeType) {}
}
