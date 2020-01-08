import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { ObjectMeta } from '../../kuberesources.objectmodel';
import { kubefsUri } from '../../kuberesources.virtualfs';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerResourceNode } from './node';
import { getChildSources, getUICustomiser } from './resourceui';
import { NODE_TYPES } from './explorer';
import { getResourceVersion } from '../../extension';

export class ResourceNode extends ClusterExplorerNodeImpl implements ClusterExplorerResourceNode {

    static create(kind: kuberesources.ResourceKind, name: string, metadata: ObjectMeta | undefined, extraInfo: ResourceExtraInfo | undefined): ClusterExplorerResourceNode {
        return new ResourceNode(kind, name, metadata, extraInfo);
    }

    readonly kindName: string;
    readonly nodeType = NODE_TYPES.resource;
    constructor(readonly kind: kuberesources.ResourceKind, readonly name: string, readonly metadata: ObjectMeta | undefined, readonly extraInfo: ResourceExtraInfo | undefined) {
        super(NODE_TYPES.resource);
        this.kindName = `${kind.abbreviation}/${name}`;
    }
    get namespace(): string | null {
        return (this.metadata && this.metadata.namespace) ? this.metadata.namespace : null;
    }
    uri(outputFormat: string): vscode.Uri {
        return kubefsUri(this.namespace, this.kindName, outputFormat);
    }
    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const childSources = getChildSources(this.kind);
        const children = Array.of<ClusterExplorerNode>();
        for (const source of childSources) {
            const sourcedChildren = await source.children(kubectl, this);
            children.push(...sourcedChildren);
        }
        return children;
    }
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const collapsibleState = this.isExpandable ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        const treeItem = new vscode.TreeItem(this.name, collapsibleState);
        treeItem.command = {
            command: "extension.vsKubernetesLoad",
            title: "Load",
            arguments: [this]
        };
        treeItem.contextValue = `vsKubernetes.resource.${this.kind.abbreviation}`;
        if (this.namespace) {
            treeItem.tooltip = `Namespace: ${this.namespace}`; // TODO: show only if in non-current namespace?
        }
        const uiCustomiser = getUICustomiser(this.kind);
        uiCustomiser.customiseTreeItem(this, treeItem);
        return treeItem;
    }
    get isExpandable(): boolean {
        return getChildSources(this.kind).length > 0;
    }

    async getPathApi(namespace: string): Promise<string> {
        const resources = this.kind.pluralDisplayName.replace(/\s/g, '').toLowerCase();
        const version = await getResourceVersion(resources);
        const baseUri = (version === 'v1') ? `/api/${version}/` : `/apis/${version}/`;
        let namespaceUri = '';
        switch (resources) {
            case "namespaces" || "nodes" || "persistentvolumes" || "storageclasses": {
                namespaceUri = `${resources}/`;
                break;
            }
            default: {
                namespaceUri = `namespaces/${namespace}/${resources}/`;
                break;
            }
        }
        return `${baseUri}${namespaceUri}${this.name}`;
    }
}

export interface ResourceExtraInfo {
    readonly configData?: any;
    readonly podInfo?: kubectlUtils.PodInfo;
    readonly labelSelector?: any;
    readonly namespaceInfo?: kubectlUtils.NamespaceInfo;
}
