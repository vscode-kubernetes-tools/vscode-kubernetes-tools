import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { ObjectMeta } from '../../kuberesources.objectmodel';
import { kubefsUri } from '../../kuberesources.virtualfs';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerResourceNode } from './node';
import { getChildSources, getUICustomiser, CustomResourceChildSources } from './resourceui';
import { NODE_TYPES } from './explorer';

export class ResourceNode extends ClusterExplorerNodeImpl implements ClusterExplorerResourceNode {

    static create(kind: kuberesources.ResourceKind, name: string, metadata: ObjectMeta | undefined, extraInfo: ResourceExtraInfo | undefined, customChildSources: CustomResourceChildSources | undefined): ClusterExplorerResourceNode {
        return new ResourceNode(kind, name, metadata, extraInfo, customChildSources);
    }

    readonly kindName: string;
    readonly nodeType = NODE_TYPES.resource;
    constructor(readonly kind: kuberesources.ResourceKind, readonly name: string, readonly metadata: ObjectMeta | undefined, readonly extraInfo: ResourceExtraInfo | undefined, readonly customChildSources: CustomResourceChildSources | undefined) {
        super(NODE_TYPES.resource);
        this.kindName = `${kind.abbreviation}/${name}`;
    }
    get namespace(): string | null {
        return (this.metadata && this.metadata.namespace) ? this.metadata.namespace : null;
    }
    get customData(): any {
        if (this.extraInfo) {
            return this.extraInfo.customData;
        }
        return undefined;
    }
    uri(outputFormat: string): vscode.Uri {
        return kubefsUri(this.namespace, this.kindName, outputFormat);
    }
    async getChildren(kubectl: Kubectl, host: Host): Promise<ClusterExplorerNode[]> {
        const defaultChildSources = this.effectiveDefaultChildSources();
        const customChildSources = this.effectiveCustomChildSources();
        const children = Array.of<ClusterExplorerNode>();
        for (const source of defaultChildSources) {
            const sourcedChildren = await source.children(kubectl, this);
            children.push(...sourcedChildren);
        }
        for (const source of customChildSources) {
            const sourcedChildren = await source(this).nodes(kubectl, host);
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
        return this.effectiveDefaultChildSources().length > 0 ||
            this.effectiveCustomChildSources().length > 0;
    }
    private includeDefaultChildSources(): boolean {
        return !this.customChildSources || this.customChildSources.includeDefaultChildSources;
    }
    private effectiveDefaultChildSources() {
        if (this.includeDefaultChildSources()) {
            return getChildSources(this.kind);
        }
        return [];
    }
    private effectiveCustomChildSources() {
        if (this.customChildSources) {
            return this.customChildSources.customSources;
        }
        return [];
    }
}

export interface ResourceExtraInfo {
    readonly configData?: any;
    readonly podInfo?: kubectlUtils.PodInfo;
    readonly labelSelector?: any;
    readonly namespaceInfo?: kubectlUtils.NamespaceInfo;
    readonly customData?: any;
}
