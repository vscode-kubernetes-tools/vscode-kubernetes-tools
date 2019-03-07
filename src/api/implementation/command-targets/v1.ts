import { CommandTargetsV1 } from "../../contract/command-targets/v1";
import { KUBERNETES_EXPLORER_NODE_CATEGORY, KubernetesObject, ResourceNode, ResourceFolder } from "../../../explorer";
import { HELM_EXPLORER_NODE_CATEGORY } from "../../../helm.repoExplorer";

export function impl(): CommandTargetsV1 {
    return new CommandTargetsV1Impl();
}

class CommandTargetsV1Impl implements CommandTargetsV1 {
    resolve(target?: any): CommandTargetsV1.CommandTarget | undefined {
        if (!target) {
            return undefined;
        }
        if (target.nodeCategory === KUBERNETES_EXPLORER_NODE_CATEGORY) {
            const node = target as KubernetesObject;
            return {
                targetType: 'kubernetes-explorer-node',
                node: adaptKubernetesExplorerNode(node)
            };
        }
        if (target.nodeCategory === HELM_EXPLORER_NODE_CATEGORY) {
            // const node = target as HelmObject;
            return {
                targetType: 'helm-explorer-node',
            };
        }
        return undefined;
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
