/* eslint-disable camelcase */

import { KubernetesExplorer, KUBERNETES_EXPLORER_NODE_CATEGORY } from "../../../components/clusterexplorer/explorer";
import { ClusterExplorerNode } from "../../../components/clusterexplorer/node";
import { ClusterExplorerV1_1 } from '../../contract/cluster-explorer/v1_1';

import { adaptKubernetesExplorerNode, adaptToExplorerUICustomizer, internalNodeContributorOf, resourceFolderContributor, groupingFolderContributor } from './common';

export function impl(explorer: KubernetesExplorer): ClusterExplorerV1_1 {
    return new ClusterExplorerV1_1Impl(explorer);
}

class ClusterExplorerV1_1Impl implements ClusterExplorerV1_1 {
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
            groupingFolder: groupingFolderContributor
        };
    }

    refresh(): void {
        this.explorer.refresh();
    }
}
