import { Kubectl } from "../../../kubectl";
import * as kubectlUtils from '../../../kubectlUtils';
import * as kuberesources from '../../../kuberesources';
import { ResourceNode } from "../node.resource";
import { ClusterExplorerNode } from "../node";

export const selectedPodsChildSource = {
    async children(kubectl: Kubectl, parent: ResourceNode): Promise<ClusterExplorerNode[]> {
        const labelSelector = parent.extraInfo!.labelSelector;  // TODO: unbang
        if (!labelSelector) {
            return [];
        }
        const pods = await kubectlUtils.getPods(kubectl, labelSelector);
        return pods.map((p) => ResourceNode.create(kuberesources.allKinds.pod, p.name, p.metadata, { podInfo: p }));
    }
};
