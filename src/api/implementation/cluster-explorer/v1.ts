import * as vscode from 'vscode';
import { KubernetesExplorer, KUBERNETES_EXPLORER_NODE_CATEGORY } from "../../../components/clusterexplorer/explorer";
import { ExplorerUICustomizer } from "../../../components/clusterexplorer/explorer.extension";
import { CustomGroupingFolderNodeSource, CustomResourceFolderNodeSource } from "../../../components/clusterexplorer/extension.nodesources";
import { ClusterExplorerNode } from "../../../components/clusterexplorer/node";
import { ResourceKind } from '../../../kuberesources';
import { ClusterExplorerV1 } from "../../contract/cluster-explorer/v1";

import { adaptKubernetesExplorerNode, apiNodeSourceOf, internalNodeContributorOf, internalNodeSourceOf } from './common';

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

function resourceFolderContributor(displayName: string, pluralDisplayName: string, manifestKind: string, abbreviation: string): ClusterExplorerV1.NodeSource {
    const nodeSource = new CustomResourceFolderNodeSource(new ResourceKind(displayName, pluralDisplayName, manifestKind, abbreviation));
    return apiNodeSourceOf(nodeSource);
}

function groupingFolderContributor(displayName: string, contextValue: string | undefined, ...children: ClusterExplorerV1.NodeSource[]): ClusterExplorerV1.NodeSource {
    const nodeSource = new CustomGroupingFolderNodeSource(displayName, contextValue, children.map(internalNodeSourceOf));
    return apiNodeSourceOf(nodeSource);
}
