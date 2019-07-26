import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { KubernetesExplorerNodeType, KUBERNETES_EXPLORER_NODE_CATEGORY, KubernetesExplorerNodeTypeError, KubernetesExplorerNodeTypeContext, KubernetesExplorerNodeTypeResourceFolder, KubernetesExplorerNodeTypeGroupingFolder, KubernetesExplorerNodeTypeResource, KubernetesExplorerNodeTypeConfigItem, KubernetesExplorerNodeTypeHelmRelease, KubernetesExplorerNodeTypeExtension } from './explorer';
import { KubectlContext } from '../../kubectlUtils';
import { ResourceKind } from '../../kuberesources';
import { ObjectMeta } from '../../kuberesources.objectmodel';

export interface ClusterExplorerNodeBase {
    readonly nodeCategory: 'kubernetes-explorer-node';
    getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<ClusterExplorerNode[]>;
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem>;
}

export interface ClusterExplorerContextNode extends ClusterExplorerNodeBase {
    readonly nodeType: KubernetesExplorerNodeTypeContext;
    readonly kubectlContext: KubectlContext;
    readonly contextName: string;
}

export interface ClusterExplorerResourceFolderNode extends ClusterExplorerNodeBase {
    readonly nodeType: KubernetesExplorerNodeTypeResourceFolder;
    readonly kind: ResourceKind;
}

export interface ClusterExplorerGroupingFolderNode extends ClusterExplorerNodeBase {
    readonly nodeType: KubernetesExplorerNodeTypeGroupingFolder;
    readonly displayName: string;
}

export interface ClusterExplorerMessageNode extends ClusterExplorerNodeBase {
    readonly nodeType: KubernetesExplorerNodeTypeError;  // TODO: should be 'message'
}

export interface ClusterExplorerResourceNode extends ClusterExplorerNodeBase {
    readonly nodeType: KubernetesExplorerNodeTypeResource;
    readonly name: string;
    readonly namespace: string | null;
    readonly kindName: string;
    readonly metadata: ObjectMeta | undefined;
    readonly kind: ResourceKind;
    readonly customData: any;
    uri(outputFormat: string): vscode.Uri;
}

export interface ClusterExplorerConfigurationValueNode extends ClusterExplorerNodeBase {
    readonly nodeType: KubernetesExplorerNodeTypeConfigItem;
    readonly key: string;
    readonly configData: any;
    readonly parentKind: ResourceKind;
    readonly parentName: string;
}

export interface ClusterExplorerHelmReleaseNode extends ClusterExplorerNodeBase {
    readonly nodeType: KubernetesExplorerNodeTypeHelmRelease;
    readonly releaseName: string;
}

export interface ClusterExplorerCustomNode extends ClusterExplorerNodeBase {
    readonly nodeType: KubernetesExplorerNodeTypeExtension;
}

export type ClusterExplorerNode =
    ClusterExplorerMessageNode |
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
