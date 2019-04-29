import * as vscode from 'vscode';

import { ClusterExplorerV1 } from "../../contract/cluster-explorer/v1";
import { ExplorerExtender, ExplorerUICustomizer } from "../../../explorer.extension";
import { KUBERNETES_EXPLORER_NODE_CATEGORY, KubernetesObject, ResourceFolder, ResourceNode, KubernetesExplorer, CustomResourceFolderContributor, CustomGroupingFolderContributor } from "../../../explorer";
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
            const implNode = target as KubernetesObject;
            const apiNode = adaptKubernetesExplorerNode(implNode);
            return apiNode;
        }
        return undefined;
    }

    registerNodeContributor(nodeContributor: ClusterExplorerV1.NodeContributor): void {
        const adapted = adaptToExplorerExtension(nodeContributor);
        this.explorer.registerExtender(adapted);
    }

    registerNodeUICustomizer(nodeUICustomizer: ClusterExplorerV1.NodeUICustomizer): void {
        const adapted = adaptToExplorerUICustomizer(nodeUICustomizer);
        this.explorer.registerUICustomiser(adapted);
    }

    get nodeContributors(): ClusterExplorerV1.NodeContributors {
        return {
            resourceFolder: resourceFolderContributor,
            groupingFolder: groupingFolderContributor
        };
    }

    refresh(): void {
        this.explorer.refresh();
    }
}

const SOOPER_SEKRIT_CONTRIBUTOR_KIND_TAG = '4a4bc473-a8c6-4b1e-973f-22327f99cea8';

interface BuiltInNodeContributor {
    readonly [SOOPER_SEKRIT_CONTRIBUTOR_KIND_TAG]: true;
    readonly impl: ExplorerExtender<KubernetesObject>;
}

function adaptToExplorerExtension(nodeContributor: ClusterExplorerV1.NodeContributor): ExplorerExtender<KubernetesObject> {
    if ((<any>nodeContributor)[SOOPER_SEKRIT_CONTRIBUTOR_KIND_TAG] === true) {
        return (nodeContributor as unknown as BuiltInNodeContributor).impl;
    }
    return new NodeContributorAdapter(nodeContributor);
}

function adaptToExplorerUICustomizer(nodeUICustomizer: ClusterExplorerV1.NodeUICustomizer): ExplorerUICustomizer<KubernetesObject> {
    return new NodeUICustomizerAdapter(nodeUICustomizer);
}

class NodeContributorAdapter implements ExplorerExtender<KubernetesObject> {
    constructor(private readonly impl: ClusterExplorerV1.NodeContributor) {}
    contributesChildren(parent?: KubernetesObject | undefined): boolean {
        const parentNode = parent ? adaptKubernetesExplorerNode(parent) : undefined;
        return this.impl.contributesChildren(parentNode);
    }
    async getChildren(parent?: KubernetesObject | undefined): Promise<KubernetesObject[]> {
        const parentNode = parent ? adaptKubernetesExplorerNode(parent) : undefined;
        const children = await this.impl.getChildren(parentNode);
        return children.map(internalNodeOf);
    }
}

class NodeUICustomizerAdapter implements ExplorerUICustomizer<KubernetesObject> {
    constructor(private readonly impl: ClusterExplorerV1.NodeUICustomizer) {}
    customize(element: KubernetesObject, treeItem: vscode.TreeItem): true | Thenable<true> {
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

function adaptKubernetesExplorerNode(node: KubernetesObject): ClusterExplorerV1.ClusterExplorerNode {
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
            return { nodeType: 'folder.resource', resourceKind: (node as KubernetesObject & ResourceFolder).kind };
        case 'resource':
            return adaptKubernetesExplorerResourceNode(node as (KubernetesObject & ResourceNode));
        case 'configitem':
            return { nodeType: 'configitem', name: node.id };
        case 'helm.release':
            return { nodeType: 'helm.release', name: node.id };
        case 'extension':
            return { nodeType: 'extension' };
    }
}

function adaptKubernetesExplorerResourceNode(node: KubernetesObject & ResourceNode): ClusterExplorerV1.ClusterExplorerResourceNode {
    return {
        nodeType: 'resource',
        metadata: node.metadata,
        name: node.id,
        resourceKind: node.kind,
        namespace: node.namespace
    };
}

function internalNodeOf(node: ClusterExplorerV1.Node): KubernetesObject {
    return new ContributedNode(node);
}

class ContributedNode implements KubernetesObject {
    readonly nodeCategory = 'kubernetes-explorer-node';
    readonly nodeType = 'extension';
    readonly id = 'dummy';

    constructor(private readonly impl: ClusterExplorerV1.Node) {}

    async getChildren(_kubectl: Kubectl, _host: Host): Promise<KubernetesObject[]> {
        return (await this.impl.getChildren()).map((n) => internalNodeOf(n));
    }
    getTreeItem(): vscode.TreeItem {
        return this.impl.getTreeItem();
    }
}

function resourceFolderContributor(parentFolder: string | undefined, displayName: string, pluralDisplayName: string, manifestKind: string, abbreviation: string): ClusterExplorerV1.NodeContributor & BuiltInNodeContributor {
    const explorerExtender = new CustomResourceFolderContributor(parentFolder, new ResourceKind(displayName, pluralDisplayName, manifestKind, abbreviation));
    return {
        contributesChildren(_parent) { return false; },
        async getChildren(_parent) { return []; },
        [SOOPER_SEKRIT_CONTRIBUTOR_KIND_TAG]: true,
        impl: explorerExtender
    };
}

function groupingFolderContributor(parentFolder: string | undefined, displayName: string, contextValue: string | undefined, children: () => Promise<ClusterExplorerV1.Node[]>): ClusterExplorerV1.NodeContributor & BuiltInNodeContributor {
    const explorerExtender = new CustomGroupingFolderContributor(parentFolder, displayName, contextValue, async () => (await children()).map(internalNodeOf));
    return {
        contributesChildren(_parent) { return false; },
        async getChildren(_parent) { return []; },
        [SOOPER_SEKRIT_CONTRIBUTOR_KIND_TAG]: true,
        impl: explorerExtender
    };
}
