import * as vscode from 'vscode';

import { ClusterExplorerV1_1 } from "../../contract/cluster-explorer/v1.1";
import { ExplorerExtender, ExplorerUICustomizer } from "../../../components/clusterexplorer/explorer.extension";
import { KUBERNETES_EXPLORER_NODE_CATEGORY, KubernetesExplorer } from "../../../components/clusterexplorer/explorer";
import { Kubectl } from "../../../kubectl";
import { Host } from "../../../host";
import { NodeSource } from "../../../components/clusterexplorer/nodesources/nodesources";
import { ResourcesNodeSource } from "../../../components/clusterexplorer/nodesources/resources";
import { CustomGroupingFolderNodeSource } from "../../../components/clusterexplorer/nodesources/folder.grouping";
import { CustomResourceFolderNodeSource } from "../../../components/clusterexplorer/nodesources/folder.resource";
import { ClusterExplorerNode, ClusterExplorerResourceNode, ClusterExplorerCustomNode } from "../../../components/clusterexplorer/node";
import { ResourceKind } from '../../../kuberesources';
import { ResourceLister, CustomResourceChildSources } from '../../../components/clusterexplorer/resourceui';
import { MessageNode } from '../../../components/clusterexplorer/node.message';
import { ResourceNode } from '../../../components/clusterexplorer/node.resource';
import { GetResourceNodesOptions } from '../../../components/clusterexplorer/nodesources/resource-options';

export function impl(explorer: KubernetesExplorer): ClusterExplorerV1_1 {
    return new ClusterExplorerV1Impl(explorer);
}

class ClusterExplorerV1Impl implements ClusterExplorerV1_1 {
    constructor(private readonly explorer: KubernetesExplorer) {}

    resolveCommandTarget(target?: any): ClusterExplorerV1_1.ClusterExplorerNode | undefined {
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

    registerNodeContributor(nodeContributor: ClusterExplorerV1_1.NodeContributor): void {
        const adapted = internalNodeContributorOf(nodeContributor);
        this.explorer.registerExtender(adapted);
    }

    registerNodeUICustomizer(nodeUICustomizer: ClusterExplorerV1_1.NodeUICustomizer): void {
        const adapted = adaptToExplorerUICustomizer(nodeUICustomizer);
        this.explorer.registerUICustomiser(adapted);
    }

    get nodeSources(): ClusterExplorerV1_1.NodeSources {
        return {
            resourceFolder: resourceFolderContributor,
            groupingFolder: groupingFolderContributor,
            resources: resourcesNodeSource
        };
    }

    refresh(): void {
        this.explorer.refresh();
    }
}

function adaptToExplorerUICustomizer(nodeUICustomizer: ClusterExplorerV1_1.NodeUICustomizer): ExplorerUICustomizer<ClusterExplorerNode> {
    return new NodeUICustomizerAdapter(nodeUICustomizer);
}

class NodeContributorAdapter implements ExplorerExtender<ClusterExplorerNode> {
    constructor(private readonly impl: ClusterExplorerV1_1.NodeContributor) {}
    contributesChildren(parent?: ClusterExplorerNode | undefined): boolean {
        const parentNode = parent ? adaptKubernetesExplorerNode(parent) : undefined;
        return this.impl.contributesChildren(parentNode);
    }
    async getChildren(_kubectl: Kubectl, _host: Host, parent?: ClusterExplorerNode | undefined): Promise<ClusterExplorerNode[]> {
        const parentNode = parent ? adaptKubernetesExplorerNode(parent) : undefined;
        const children = await this.impl.getChildren(parentNode);
        return children.map(internalNodeOf);
    }
}

class NodeUICustomizerAdapter implements ExplorerUICustomizer<ClusterExplorerNode> {
    constructor(private readonly impl: ClusterExplorerV1_1.NodeUICustomizer) {}
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

function adaptKubernetesExplorerNode(node: ClusterExplorerNode): ClusterExplorerV1_1.ClusterExplorerNode {
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
        case 'extension':
            return { nodeType: 'extension' };
    }
}

function adaptKubernetesExplorerResourceNode(node: ClusterExplorerResourceNode): ClusterExplorerV1_1.ClusterExplorerResourceNode {
    return {
        nodeType: 'resource',
        metadata: node.metadata,
        name: node.name,
        resourceKind: node.kind,
        namespace: node.namespace,
        customData: node.customData,
    };
}

export class ContributedNode implements ClusterExplorerCustomNode {
    readonly nodeCategory = 'kubernetes-explorer-node';
    readonly nodeType = 'extension';
    readonly id = 'dummy';

    constructor(private readonly impl: ClusterExplorerV1_1.Node) { }

    async getChildren(_kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        return (await this.impl.getChildren()).map((n) => internalNodeOf(n));
    }
    getTreeItem(): vscode.TreeItem {
        return this.impl.getTreeItem();
    }
}

function resourceFolderContributor(displayName: string, pluralDisplayName: string, manifestKind: string, abbreviation: string, options?: ClusterExplorerV1_1.ResourcesNodeSourceOptions): ClusterExplorerV1_1.NodeSource {
    const optionsImpl = adaptResourcesNodeSourceOptions(options);
    const nodeSource = new CustomResourceFolderNodeSource(new ResourceKind(displayName, pluralDisplayName, manifestKind, abbreviation), optionsImpl);
    return apiNodeSourceOf(nodeSource);
}

function groupingFolderContributor(displayName: string, contextValue: string | undefined, ...children: ClusterExplorerV1_1.NodeSource[]): ClusterExplorerV1_1.NodeSource {
    const nodeSource = new CustomGroupingFolderNodeSource(displayName, contextValue, children.map(internalNodeSourceOf));
    return apiNodeSourceOf(nodeSource);
}

function resourcesNodeSource(manifestKind: string, abbreviation: string, options?: ClusterExplorerV1_1.ResourcesNodeSourceOptions): ClusterExplorerV1_1.NodeSource {
    const optionsImpl = adaptResourcesNodeSourceOptions(options);
    const nodeSource = new ResourcesNodeSource(new ResourceKind(manifestKind, manifestKind, manifestKind, abbreviation), optionsImpl);
    return apiNodeSourceOf(nodeSource);
}

function adaptResourcesNodeSourceOptions(source: ClusterExplorerV1_1.ResourcesNodeSourceOptions | undefined): GetResourceNodesOptions {
    if (!source) {
        return {};
    }
    const lister = source.lister;
    const filter = source.filter;
    const childSources = source.childSources;

    const adaptedFilter = filter ? (cern: ClusterExplorerResourceNode) => filter(adaptKubernetesExplorerResourceNode(cern)) : undefined;
    const adaptedChildSources = childSources ? { includeDefaultChildSources: childSources.includeDefault, customSources: childSources.sources.map(adaptChildSource) } : undefined;
    const adaptedLister = resourceListerOf(lister, adaptedChildSources);

    return {
        lister: adaptedLister,
        filter: adaptedFilter,
        childSources: adaptedChildSources,
    };
}

function isErrorMessage(o: ClusterExplorerV1_1.ResourceListEntry[] | ClusterExplorerV1_1.ExtensionError): o is ClusterExplorerV1_1.ExtensionError {
    return !!((o as ClusterExplorerV1_1.ExtensionError).errorMessage);
}

function resourceListerOf(
    lister: (() => Promise<ClusterExplorerV1_1.ResourceListEntry[] | ClusterExplorerV1_1.ExtensionError>) | undefined,
    childSources: CustomResourceChildSources | undefined
    ): ResourceLister | undefined {
    if (!lister) {
        return undefined;
    }

    return {
        async list(_kubectl: Kubectl, kind: ResourceKind) {
            const infos = await lister();
            if (isErrorMessage(infos)) {
                return [new MessageNode('Error', infos.errorMessage)];
            }
            return infos.map((i) => ResourceNode.createForCustom(kind, i.name, i.customData, childSources));
        }
    };
}

function adaptChildSource(childSource: (parent: ClusterExplorerV1_1.ClusterExplorerResourceNode) => ClusterExplorerV1_1.NodeSource): (parent: ClusterExplorerResourceNode) => NodeSource {
    return (parent) => internalNodeSourceOf(childSource(adaptKubernetesExplorerResourceNode(parent)));
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
    readonly impl: NodeSource;
}

interface BuiltInNode {
    readonly [BUILT_IN_NODE_KIND_TAG]: true;
    readonly impl: ClusterExplorerNode;
}

function apiNodeSourceOf(nodeSet: NodeSource): ClusterExplorerV1_1.NodeSource & BuiltInNodeSource {
    return {
        at(parent: string | undefined) { const ee = nodeSet.at(parent); return apiNodeContributorOf(ee); },
        if(condition: () => boolean | Thenable<boolean>) { return apiNodeSourceOf(nodeSet.if(condition)); },
        async nodes() { throw new Error('TODO: please do not call this'); },
        [BUILT_IN_NODE_SOURCE_KIND_TAG]: true,
        impl: nodeSet
    };
}

function internalNodeSourceOf(nodeSet: ClusterExplorerV1_1.NodeSource): NodeSource {
    if ((<any>nodeSet)[BUILT_IN_NODE_SOURCE_KIND_TAG]) {
        return (nodeSet as unknown as BuiltInNodeSource).impl;
    }
    return {
        at(parent: string | undefined) { return internalNodeContributorOf(nodeSet.at(parent)); },
        if(condition: () => boolean | Thenable<boolean>) { return internalNodeSourceOf(nodeSet).if(condition); },
        async nodes() { throw new Error('TODO: you should not be creating node sources yourself you naughty people'); }
    };
}

function internalNodeContributorOf(nodeContributor: ClusterExplorerV1_1.NodeContributor): ExplorerExtender<ClusterExplorerNode> {
    if ((<any>nodeContributor)[BUILT_IN_CONTRIBUTOR_KIND_TAG] === true) {
        return (nodeContributor as unknown as BuiltInNodeContributor).impl;
    }
    return new NodeContributorAdapter(nodeContributor);
}

function apiNodeContributorOf(ee: ExplorerExtender<ClusterExplorerNode>): ClusterExplorerV1_1.NodeContributor & BuiltInNodeContributor {
    return {
        contributesChildren(_parent) { return false; },
        async getChildren(_parent) { return []; },
        [BUILT_IN_CONTRIBUTOR_KIND_TAG]: true,
        impl: ee
    };
}

export function internalNodeOf(node: ClusterExplorerV1_1.Node): ClusterExplorerNode {
    if ((<any>node)[BUILT_IN_NODE_KIND_TAG]) {
        return (node as unknown as BuiltInNode).impl;
    }
    return new ContributedNode(node);
}
