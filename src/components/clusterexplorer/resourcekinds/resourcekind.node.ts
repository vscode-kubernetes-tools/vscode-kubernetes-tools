import { Kubectl } from "../../../kubectl";
import * as kubectlUtils from '../../../kubectlUtils';
import * as kuberesources from '../../../kuberesources';
import { ResourceNode } from "../node.resource";
import { ClusterExplorerNode } from "../node";

export const nodePodsChildSource = {
    async children(kubectl: Kubectl, parent: ResourceNode): Promise<ClusterExplorerNode[]> {
        const pods = await kubectlUtils.getPods(kubectl, null, 'all');
        const filteredPods = pods.filter((p) => `node/${p.nodeName}` === parent.kindName);
        return filteredPods.map((p) => ResourceNode.create(kuberesources.allKinds.pod, p.name, p.metadata, { podInfo: p }));
    }
};
