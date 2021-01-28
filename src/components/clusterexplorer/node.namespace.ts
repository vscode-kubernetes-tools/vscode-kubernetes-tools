import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerNamespaceNode } from './node';
import { HelmReleasesFolder } from "./node.folder.helmreleases";
import { CRDTypesFolderNode } from "./node.folder.crdtypes";
import { workloadsGroupingFolder, networkGroupingFolder, storageGroupingFolder, configurationGroupingFolder } from "./node.folder.grouping";
import { NODE_TYPES } from './explorer';
import { assetUri } from '../../assets';

const KUBERNETES_NAMESPACE = "vsKubernetes.namespace";

export class NamespaceNode extends ClusterExplorerNodeImpl implements ClusterExplorerNamespaceNode {
    constructor(readonly contextName: string, readonly kubectlContext: kubectlUtils.KubectlContext) {
        super(NODE_TYPES.namespace);
    }
    readonly nodeType = NODE_TYPES.namespace;
    get icon(): vscode.Uri {
        return assetUri("images/k8s-logo.png");
    }
    get clusterType(): string {
        return KUBERNETES_NAMESPACE;
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        if (this.kubectlContext.active) {
            return [
                workloadsGroupingFolder(),
                networkGroupingFolder(),
                storageGroupingFolder(),
                configurationGroupingFolder(),
                new CRDTypesFolderNode(),
                new HelmReleasesFolder(),
            ];
        }
        return [];
    }
    getBaseTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        let name = 'default';
        if (this.kubectlContext && this.kubectlContext.namespace) {
            name = this.kubectlContext.namespace;
        }
        const treeItem = new vscode.TreeItem(name, vscode.TreeItemCollapsibleState.Expanded);
        treeItem.contextValue = this.clusterType;
        return treeItem;
    }
    async apiURI(_kubectl: Kubectl, _namespace: string): Promise<string | undefined> {
        return undefined;
    }
}
