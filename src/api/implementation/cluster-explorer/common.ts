/* eslint-disable camelcase */

import * as vscode from 'vscode';
import { KUBERNETES_EXPLORER_NODE_CATEGORY } from "../../../components/clusterexplorer/explorer";
import { ExplorerExtender, ExplorerUICustomizer } from "../../../components/clusterexplorer/explorer.extension";
import { CustomGroupingFolderNodeSource, CustomResourceFolderNodeSource, NodeSourceImpl } from "../../../components/clusterexplorer/extension.nodesources";
import { ClusterExplorerCustomNode, ClusterExplorerNode, ClusterExplorerResourceNode } from "../../../components/clusterexplorer/node";
import { Host } from "../../../host";
import { Kubectl } from "../../../kubectl";
import { ResourceKind } from '../../../kuberesources';

import { ClusterExplorerV1 } from '../../contract/cluster-explorer/v1';
import { ClusterExplorerV1_1 } from '../../contract/cluster-explorer/v1_1';

export interface NodeContributor {
    contributesChildren(parent: ClusterExplorerV1.ClusterExplorerNode | ClusterExplorerV1_1.ClusterExplorerNode | undefined): boolean;
    getChildren(parent: ClusterExplorerV1.ClusterExplorerNode | ClusterExplorerV1_1.ClusterExplorerNode | undefined): Promise<Node[]>;
}

export interface Node {
    getChildren(): Promise<Node[]>;
    getTreeItem(): vscode.TreeItem;
}

export interface NodeSource {
    at(parentFolder: string | undefined): NodeContributor;
    if(condition: () => boolean | Thenable<boolean>): NodeSource;
    nodes(): Promise<Node[]>;
}

export function resolveCommandTarget(target?: any): (ClusterExplorerV1.ClusterExplorerNode & ClusterExplorerV1_1.ClusterExplorerNode) | undefined {
    if (!target) {
        return undefined;
    }
    if (target.nodeCategory === KUBERNETES_EXPLORER_NODE_CATEGORY) {
        const implNode = target as ClusterExplorerNode;
        const apiNode = adaptKubernetesExplorerNode(implNode);
        return apiNode;
    }
    return undefined;
}

export function adaptToExplorerUICustomizer(nodeUICustomizer: ClusterExplorerV1.NodeUICustomizer | ClusterExplorerV1_1.NodeUICustomizer): ExplorerUICustomizer<ClusterExplorerNode> {
    return new NodeUICustomizerAdapter(nodeUICustomizer);
}

class NodeUICustomizerAdapter implements ExplorerUICustomizer<ClusterExplorerNode> {
    constructor(private readonly impl: ClusterExplorerV1.NodeUICustomizer | ClusterExplorerV1_1.NodeUICustomizer) {}
    customize(element: ClusterExplorerNode, treeItem: vscode.TreeItem): true | Thenable<true> {
        const node = adaptKubernetesExplorerNode(element);
        if (!node) {
            return true;
        }
        const waiter = this.impl.customize(node, treeItem);
        if (waiter) {
            return waitFor(waiter);
        }
        return true;
    }
}

async function waitFor(waiter: Thenable<void>): Promise<true> {
    await waiter;
    return true;
}

export class NodeContributorAdapter implements ExplorerExtender<ClusterExplorerNode> {
    constructor(private readonly impl: ClusterExplorerV1.NodeContributor | ClusterExplorerV1_1.NodeContributor) {}
    contributesChildren(parent?: ClusterExplorerNode | undefined): boolean {
        const parentNode = parent ? adaptKubernetesExplorerNode(parent) : undefined;
        return this.impl.contributesChildren(parentNode);
    }
    async getChildren(parent?: ClusterExplorerNode | undefined): Promise<ClusterExplorerNode[]> {
        const parentNode = parent ? adaptKubernetesExplorerNode(parent) : undefined;
        const children = await this.impl.getChildren(parentNode);
        return children.map(internalNodeOf);
    }
}

function adaptKubernetesExplorerNode(node: ClusterExplorerNode): (ClusterExplorerV1.ClusterExplorerNode & ClusterExplorerV1_1.ClusterExplorerNode) | undefined {
    switch (node.nodeType) {
        case 'error':
            return { nodeType: 'error' };
        case 'context':
            return node.kubectlContext.active ?
                { nodeType: 'context', name: node.contextName } :
                { nodeType: 'context.inactive', name: node.contextName };
        case 'folder.grouping':
            return { nodeType: 'folder.grouping' };
        case 'folder.resource':
            return { nodeType: 'folder.resource', resourceKind: node.kind };
        case 'resource':
            return adaptKubernetesExplorerResourceNode(node);
        case 'configitem':
            return { nodeType: 'configitem', name: node.key };
        case 'helm.release':
            return { nodeType: 'helm.release', name: node.releaseName };
        case 'helm.history':
        case 'extension':
            return { nodeType: 'extension' };
        default:
            return undefined;
    }
}

function adaptKubernetesExplorerResourceNode(node: ClusterExplorerResourceNode): ClusterExplorerV1.ClusterExplorerResourceNode & ClusterExplorerV1_1.ClusterExplorerResourceNode {
    return {
        nodeType: 'resource',
        metadata: node.metadata,
        name: node.name,
        resourceKind: node.kind,
        namespace: node.namespace
    };
}

export function allNodeSources(): ClusterExplorerV1.NodeSources & ClusterExplorerV1_1.NodeSources {
    return {
        resourceFolder: resourceFolderContributor,
        groupingFolder: groupingFolderContributor
    };
}

const BUILT_IN_CONTRIBUTOR_KIND_TAG = 'nativeextender-4a4bc473-a8c6-4b1e-973f-22327f99cea8';
const BUILT_IN_NODE_KIND_TAG = 'nativek8sobject-5be3c876-3683-44cd-a400-7763d2c4302a';
const BUILT_IN_NODE_SOURCE_KIND_TAG = 'nativenodesource-aa0c30a9-bf1d-444a-a147-7823edcc7c04';

export interface BuiltInNodeContributor {
    readonly [BUILT_IN_CONTRIBUTOR_KIND_TAG]: true;
    readonly impl: ExplorerExtender<ClusterExplorerNode>;
}

export interface BuiltInNodeSource {
    readonly [BUILT_IN_NODE_SOURCE_KIND_TAG]: true;
    readonly impl: NodeSourceImpl;
}

export interface BuiltInNode {
    readonly [BUILT_IN_NODE_KIND_TAG]: true;
    readonly impl: ClusterExplorerNode;
}

export class ContributedNode implements ClusterExplorerCustomNode {
    readonly nodeCategory = 'kubernetes-explorer-node';
    readonly nodeType = 'extension';
    readonly id = 'dummy';

    constructor(private readonly impl: Node) { }

    async getChildren(_kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        return (await this.impl.getChildren()).map((n) => internalNodeOf(n));
    }
    getTreeItem(): vscode.TreeItem {
        return this.impl.getTreeItem();
    }
    async apiURI(_kubectl: Kubectl, _namespace: string): Promise<string | undefined> {
        return undefined;
    }
}

export function apiNodeSourceOf(nodeSet: NodeSourceImpl): NodeSource & BuiltInNodeSource {
    return {
        at(parent: string | undefined) { const ee = nodeSet.at(parent); return apiNodeContributorOf(ee); },
        if(condition: () => boolean | Thenable<boolean>) { return apiNodeSourceOf(nodeSet.if(condition)); },
        async nodes() { return (await nodeSet.nodes()).map(apiNodeOf); },
        [BUILT_IN_NODE_SOURCE_KIND_TAG]: true,
        impl: nodeSet
    };
}

export function apiNodeContributorOf(ee: ExplorerExtender<ClusterExplorerNode>): NodeContributor & BuiltInNodeContributor {
    return {
        contributesChildren(_parent) { return false; },
        async getChildren(_parent) { return []; },
        [BUILT_IN_CONTRIBUTOR_KIND_TAG]: true,
        impl: ee
    };
}

export function apiNodeOf(node: ClusterExplorerNode): Node & BuiltInNode {
    return {
        async getChildren() { throw new Error('apiNodeOf->getChildren: not expected to be called directly'); },
        getTreeItem() { throw new Error('apiNodeOf->getTreeItem: not expected to be called directly'); },
        [BUILT_IN_NODE_KIND_TAG]: true,
        impl: node
    };
}

export function internalNodeSourceOf(nodeSet: ClusterExplorerV1.NodeSource | ClusterExplorerV1_1.NodeSource): NodeSourceImpl {
    if ((<any>nodeSet)[BUILT_IN_NODE_SOURCE_KIND_TAG]) {
        return (nodeSet as unknown as BuiltInNodeSource).impl;
    }
    return {
        at(parent: string | undefined) { return internalNodeContributorOf(nodeSet.at(parent)); },
        if(condition: () => boolean | Thenable<boolean>) { return internalNodeSourceOf(nodeSet).if(condition); },
        async nodes() { return (await nodeSet.nodes()).map(internalNodeOf); }
    };
}

export function internalNodeContributorOf(nodeContributor: ClusterExplorerV1.NodeContributor | ClusterExplorerV1_1.NodeContributor): ExplorerExtender<ClusterExplorerNode> {
    if ((<any>nodeContributor)[BUILT_IN_CONTRIBUTOR_KIND_TAG] === true) {
        return (nodeContributor as unknown as BuiltInNodeContributor).impl;
    }
    return new NodeContributorAdapter(nodeContributor);
}

export function internalNodeOf(node: ClusterExplorerV1.Node | ClusterExplorerV1_1.Node): ClusterExplorerNode {
    if ((<any>node)[BUILT_IN_NODE_KIND_TAG]) {
        return (node as unknown as BuiltInNode).impl;
    }
    return new ContributedNode(node);
}

function resourceFolderContributor(displayName: string, pluralDisplayName: string, manifestKind: string, abbreviation: string, apiName?: string): NodeSource {
    const nodeSource = new CustomResourceFolderNodeSource(new ResourceKind(displayName, pluralDisplayName, manifestKind, abbreviation, apiName));
    return apiNodeSourceOf(nodeSource);
}

function groupingFolderContributor(displayName: string, contextValue: string | undefined, ...children: NodeSource[]): NodeSource {
    const nodeSource = new CustomGroupingFolderNodeSource(displayName, contextValue, children.map(internalNodeSourceOf));
    return apiNodeSourceOf(nodeSource);
}
