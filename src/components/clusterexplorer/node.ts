import * as vscode from 'vscode';
import { HelmRelease } from '../../helm.exec';
import { Host } from '../../host';
import { Kubectl } from '../../kubectl';
import { KubectlContext } from '../../kubectlUtils';
import { ResourceKind } from '../../kuberesources';
import { ObjectMeta } from '../../kuberesources.objectmodel';
import { KubernetesExplorerNodeType, KubernetesExplorerNodeTypeConfigItem, KubernetesExplorerNodeTypeContext, KubernetesExplorerNodeTypeError, KubernetesExplorerNodeTypeExtension, KubernetesExplorerNodeTypeGroupingFolder, KubernetesExplorerNodeTypeHelmHistory, KubernetesExplorerNodeTypeHelmRelease, KubernetesExplorerNodeTypeResource, KubernetesExplorerNodeTypeResourceFolder, KUBERNETES_EXPLORER_NODE_CATEGORY, KubernetesExplorerNodeTypeCluster } from './explorer';


export interface ClusterExplorerNodeBase {
    readonly nodeCategory: 'kubernetes-explorer-node';
    getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<ClusterExplorerNode[]>;
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem>;
    apiURI(kubectl: Kubectl, namespace: string): Promise<string | undefined>;
}

export interface ClusterExplorerClusterNode extends ClusterExplorerNodeBase {
    readonly nodeType: KubernetesExplorerNodeTypeCluster;
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
    readonly namespace: string;
    readonly kindName: string;
    readonly metadata: ObjectMeta;
    readonly kind: ResourceKind;
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

export interface ClusterExplorerHelmHistoryNode extends ClusterExplorerNodeBase {
    readonly nodeType: KubernetesExplorerNodeTypeHelmHistory;
    readonly releaseName: string;
    readonly release: HelmRelease;
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
    ClusterExplorerHelmHistoryNode |
    ClusterExplorerCustomNode;

export type ClusterExplorerNodev2 =
    ClusterExplorerMessageNode |
    ClusterExplorerClusterNode |
    ClusterExplorerContextNode |
    ClusterExplorerResourceFolderNode |
    ClusterExplorerGroupingFolderNode |
    ClusterExplorerResourceNode |
    ClusterExplorerConfigurationValueNode |
    ClusterExplorerHelmReleaseNode |
    ClusterExplorerHelmHistoryNode |
    ClusterExplorerCustomNode;

export class ClusterExplorerNodeImpl {
    readonly nodeCategory = KUBERNETES_EXPLORER_NODE_CATEGORY;
    constructor(readonly nodeType: KubernetesExplorerNodeType) {}
}
