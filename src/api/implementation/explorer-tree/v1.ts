import * as vscode from 'vscode';

import { ExplorerTreeV1 } from "../../contract/explorer-tree/v1";
import { ExplorerExtendable, ExplorerExtender } from "../../../explorer.extension";
import { KubernetesObject, ResourceFolder, ResourceNode } from "../../../explorer";
import { CommandTargetsV1 } from "../../contract/command-targets/v1";
import { Kubectl } from "../../../kubectl";
import { Host } from "../../../host";

export function impl(explorer: ExplorerExtendable<KubernetesObject>): ExplorerTreeV1 {
    return new ExplorerTreeV1Impl(explorer);
}

class ExplorerTreeV1Impl implements ExplorerTreeV1 {
    constructor(private readonly explorer: ExplorerExtendable<KubernetesObject>) {}

    registerNodeContributor(nodeContributor: ExplorerTreeV1.NodeContributor): void {
        const adapted = adaptToExplorerExtension(nodeContributor);
        this.explorer.register(adapted);
    }
}

function adaptToExplorerExtension(nodeContributor: ExplorerTreeV1.NodeContributor): ExplorerExtender<KubernetesObject> {
    return new NodeContributorAdapter(nodeContributor);
}

class NodeContributorAdapter implements ExplorerExtender<KubernetesObject> {
    constructor(private readonly impl: ExplorerTreeV1.NodeContributor) {}
    contributesChildren(parent?: KubernetesObject | undefined): boolean {
        const parentNode = parent ? adaptKubernetesExplorerNode(parent) : undefined;
        return this.impl.contributesChildren(parentNode);
    }
    async getChildren(parent?: KubernetesObject | undefined): Promise<KubernetesObject[]> {
        const parentNode = parent ? adaptKubernetesExplorerNode(parent) : undefined;
        const children = await this.impl.getChildren(parentNode);
        return children.map(objectulise);
    }
}

function adaptKubernetesExplorerNode(node: KubernetesObject): CommandTargetsV1.KubernetesExplorerNode {
    switch (node.nodeType) {
        case 'error':
            return { nodeType: 'error' };
        case 'context':
            return { nodeType: 'context', name: node.id };
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

function adaptKubernetesExplorerResourceNode(node: KubernetesObject & ResourceNode): CommandTargetsV1.KubernetesExplorerResourceNode {
    return {
        nodeType: 'resource',
        metadata: node.metadata,
        name: node.id,
        resourceKind: node.kind,
        namespace: node.namespace
    };
}

function objectulise(node: ExplorerTreeV1.Node): KubernetesObject {
    return new Objectulisation(node);
}

class Objectulisation implements KubernetesObject {
    readonly nodeCategory = 'kubernetes-explorer-node';
    readonly nodeType = 'extension';
    readonly id = 'dummy';

    constructor(readonly impl: ExplorerTreeV1.Node) {}

    async getChildren(_kubectl: Kubectl, _host: Host): Promise<KubernetesObject[]> {
        return (await this.impl.getChildren()).map((n) => objectulise(n));
    }
    getTreeItem(): vscode.TreeItem {
        return this.impl.getTreeItem();
    }
}
