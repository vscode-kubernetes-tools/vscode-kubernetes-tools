import * as vscode from 'vscode';

import { ClusterExplorerV1 } from "../../contract/cluster-explorer/v1";
import { ExplorerExtender, ExplorerUICustomizer } from "../../../components/clusterexplorer/explorer.extension";
import { KUBERNETES_EXPLORER_NODE_CATEGORY, ResourceFolder, ResourceNode, KubernetesExplorer, CustomResourceFolderNodeSource, CustomGroupingFolderNodeSource, NodeSourceImpl } from "../../../components/clusterexplorer/explorer";
import { ClusterExplorerNode } from "../../../components/clusterexplorer/node";
import { Kubectl } from "../../../kubectl";
import { Host } from "../../../host";
import { KubectlContext } from '../../../kubectlUtils';
import { ResourceKind } from '../../../kuberesources';

export function impl(explorer: KubernetesExplorer): ClusterExplorerV1 {
    return new ClusterExplorerV1Impl(explorer);
}

class ClusterExplorerV1Impl implements ClusterExplorerV1 {
    constructor(private readonly explorer: KubernetesExplorer) {}

    resolveCommandTarget(target?: any): ClusterExplorerV1.ClusterExplorerNode | undefined {
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

    registerNodeContributor(nodeContributor: ClusterExplorerV1.NodeContributor): void {
        const adapted = internalNodeContributorOf(nodeContributor);
        this.explorer.registerExtender(adapted);
    }

    registerNodeUICustomizer(nodeUICustomizer: ClusterExplorerV1.NodeUICustomizer): void {
        const adapted = adaptToExplorerUICustomizer(nodeUICustomizer);
        this.explorer.registerUICustomiser(adapted);
    }

    get nodeSources(): ClusterExplorerV1.NodeSources {
        return {
            resourceFolder: resourceFolderContributor,
            groupingFolder: groupingFolderContributor
        };
    }

    refresh(): void {
        this.explorer.refresh();
    }
}

function adaptToExplorerUICustomizer(nodeUICustomizer: ClusterExplorerV1.NodeUICustomizer): ExplorerUICustomizer<ClusterExplorerNode> {
    return new NodeUICustomizerAdapter(nodeUICustomizer);
}

class NodeContributorAdapter implements ExplorerExtender<ClusterExplorerNode> {
    constructor(private readonly impl: ClusterExplorerV1.NodeContributor) {}
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

class NodeUICustomizerAdapter implements ExplorerUICustomizer<ClusterExplorerNode> {
    constructor(private readonly impl: ClusterExplorerV1.NodeUICustomizer) {}
    customize(element: ClusterExplorerNode, treeItem: vscode.TreeItem): true | Thenable<true> {
        const waiter = this.impl.customize(adaptKubernetesExplorerNode(element), treeItem);
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

function adaptKubernetesExplorerNode(node: ClusterExplorerNode): ClusterExplorerV1.ClusterExplorerNode {
    switch (node.nodeType) {
        case 'error':
            return { nodeType: 'error' };
        case 'context':
            return (node.metadata as KubectlContext).active ?
                { nodeType: 'context', name: node.id } :
                { nodeType: 'context.inactive', name: node.id };
        case 'folder.grouping':
            return { nodeType: 'folder.grouping' };
        case 'folder.resource':
            return { nodeType: 'folder.resource', resourceKind: (node as ClusterExplorerNode & ResourceFolder).kind };
        case 'resource':
            return adaptKubernetesExplorerResourceNode(node as (ClusterExplorerNode & ResourceNode));
        case 'configitem':
            return { nodeType: 'configitem', name: node.id };
        case 'helm.release':
            return { nodeType: 'helm.release', name: node.id };
        case 'extension':
            return { nodeType: 'extension' };
    }
}

function adaptKubernetesExplorerResourceNode(node: ClusterExplorerNode & ResourceNode): ClusterExplorerV1.ClusterExplorerResourceNode {
    return {
        nodeType: 'resource',
        metadata: node.metadata,
        name: node.id,
        resourceKind: node.kind,
        namespace: node.namespace
    };
}

class ContributedNode implements ClusterExplorerNode {
    readonly nodeCategory = 'kubernetes-explorer-node';
    readonly nodeType = 'extension';
    readonly id = 'dummy';

    constructor(private readonly impl: ClusterExplorerV1.Node) {}

    async getChildren(_kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        return (await this.impl.getChildren()).map((n) => internalNodeOf(n));
    }
    getTreeItem(): vscode.TreeItem {
        return this.impl.getTreeItem();
    }
}

function resourceFolderContributor(displayName: string, pluralDisplayName: string, manifestKind: string, abbreviation: string): ClusterExplorerV1.NodeSource {
    const nodeSource = new CustomResourceFolderNodeSource(new ResourceKind(displayName, pluralDisplayName, manifestKind, abbreviation));
    return apiNodeSourceOf(nodeSource);
}

function groupingFolderContributor(displayName: string, contextValue: string | undefined, ...children: ClusterExplorerV1.NodeSource[]): ClusterExplorerV1.NodeSource {
    const nodeSource = new CustomGroupingFolderNodeSource(displayName, contextValue, children.map(internalNodeSourceOf));
    return apiNodeSourceOf(nodeSource);
}

const BUILT_IN_CONTRIBUTOR_KIND_TAG = 'nativeextender-4a4bc473-a8c6-4b1e-973f-22327f99cea8';
const BUILT_IN_NODE_KIND_TAG = 'nativek8sobject-5be3c876-3683-44cd-a400-7763d2c4302a';
const BUILT_IN_NODE_SOURCE_KIND_TAG = 'nativenodesource-aa0c30a9-bf1d-444a-a147-7823edcc7c04';

interface BuiltInNodeContributor {
    readonly [BUILT_IN_CONTRIBUTOR_KIND_TAG]: true;
    readonly impl: ExplorerExtender<ClusterExplorerNode>;
}

interface BuiltInNodeSource {
    readonly [BUILT_IN_NODE_SOURCE_KIND_TAG]: true;
    readonly impl: NodeSourceImpl;
}

interface BuiltInNode {
    readonly [BUILT_IN_NODE_KIND_TAG]: true;
    readonly impl: ClusterExplorerNode;
}

function apiNodeSourceOf(nodeSet: NodeSourceImpl): ClusterExplorerV1.NodeSource & BuiltInNodeSource {
    return {
        at(parent: string | undefined) { const ee = nodeSet.at(parent); return apiNodeContributorOf(ee); },
        if(condition: () => boolean | Thenable<boolean>) { return apiNodeSourceOf(nodeSet.if(condition)); },
        async nodes() { return (await nodeSet.nodes()).map(apiNodeOf); },
        [BUILT_IN_NODE_SOURCE_KIND_TAG]: true,
        impl: nodeSet
    };
}

function internalNodeSourceOf(nodeSet: ClusterExplorerV1.NodeSource): NodeSourceImpl {
    if ((<any>nodeSet)[BUILT_IN_NODE_SOURCE_KIND_TAG]) {
        return (nodeSet as unknown as BuiltInNodeSource).impl;
    }
    return {
        at(parent: string | undefined) { return internalNodeContributorOf(nodeSet.at(parent)); },
        if(condition: () => boolean | Thenable<boolean>) { return internalNodeSourceOf(nodeSet).if(condition); },
        async nodes() { return (await nodeSet.nodes()).map(internalNodeOf); }
    };
}

function internalNodeContributorOf(nodeContributor: ClusterExplorerV1.NodeContributor): ExplorerExtender<ClusterExplorerNode> {
    if ((<any>nodeContributor)[BUILT_IN_CONTRIBUTOR_KIND_TAG] === true) {
        return (nodeContributor as unknown as BuiltInNodeContributor).impl;
    }
    return new NodeContributorAdapter(nodeContributor);
}

function apiNodeContributorOf(ee: ExplorerExtender<ClusterExplorerNode>): ClusterExplorerV1.NodeContributor & BuiltInNodeContributor {
    return {
        contributesChildren(_parent) { return false; },
        async getChildren(_parent) { return []; },
        [BUILT_IN_CONTRIBUTOR_KIND_TAG]: true,
        impl: ee
    };
}

function internalNodeOf(node: ClusterExplorerV1.Node): ClusterExplorerNode {
    if ((<any>node)[BUILT_IN_NODE_KIND_TAG]) {
        return (node as unknown as BuiltInNode).impl;
    }
    return new ContributedNode(node);
}

function apiNodeOf(node: ClusterExplorerNode): ClusterExplorerV1.Node & BuiltInNode {
    return {
        async getChildren() { throw new Error('apiNodeOf->getChildren: not expected to be called directly'); },
        getTreeItem() { throw new Error('apiNodeOf->getTreeItem: not expected to be called directly'); },
        [BUILT_IN_NODE_KIND_TAG]: true,
        impl: node
    };
}
