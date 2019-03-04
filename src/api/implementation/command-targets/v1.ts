import { CommandTargetsV1 } from "../../contract/command-targets/v1";
import { KUBERNETES_EXPLORER_NODE_CATEGORY, KubernetesObject } from "../../../explorer";
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
                id: node.id
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
