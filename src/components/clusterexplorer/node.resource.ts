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

export class ResourceNode extends ClusterExplorerNodeImpl implements ClusterExplorerResourceNode {

    static create(kind: kuberesources.ResourceKind, name: string, metadata: ObjectMeta, extraInfo: ResourceExtraInfo | undefined): ClusterExplorerResourceNode {
        return new ResourceNode(kind, name, metadata, extraInfo);
    }

    readonly kindName: string;
    readonly nodeType = NODE_TYPES.resource;
    constructor(readonly kind: kuberesources.ResourceKind, readonly name: string, readonly metadata: ObjectMeta, readonly extraInfo: ResourceExtraInfo | undefined) {
        super(NODE_TYPES.resource);
        this.kindName = `${kind.abbreviation}/${name}`;
    }
    get namespace(): string {
        return this.metadata.namespace;
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

        treeItem.tooltip = `${this.kind.label}: ${this.name}`;

        const uiCustomiser = getUICustomiser(this.kind);
        uiCustomiser.customiseTreeItem(this, treeItem);
        return treeItem;
    }
    get isExpandable(): boolean {
        return getChildSources(this.kind).length > 0;
    }

    async apiURI(kubectl: Kubectl, namespace: string): Promise<string | undefined> {
        if (!this.kind.apiName) {
            return undefined;
        }
        const resources = this.kind.apiName.replace(/\s/g, '').toLowerCase();
        const version = await kubectlUtils.getResourceVersion(kubectl, resources);
        if (!version) {
            return undefined;
        }
        const baseUri = (version === 'v1') ? `/api/${version}/` : `/apis/${version}/`;
        const namespaceUri = this.namespaceUriPart(namespace, resources);
        return `${baseUri}${namespaceUri}${this.name}`;
    }

    private namespaceUriPart(ns: string, resources: string): string {
        let namespaceUri = '';
        switch (resources) {
            case "namespaces" || "nodes" || "persistentvolumes" || "storageclasses": {
                namespaceUri = `${resources}/`;
                break;
            }
            default: {
                namespaceUri = `namespaces/${ns}/${resources}/`;
                break;
            }
        }
        return namespaceUri;
    }
}

export interface ResourceExtraInfo {
    readonly configData?: any;
    readonly podInfo?: kubectlUtils.PodInfo;
    readonly labelSelector?: any;
    readonly namespaceInfo?: kubectlUtils.NamespaceInfo;
}
