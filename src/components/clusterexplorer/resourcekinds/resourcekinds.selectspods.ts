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
        const serviceSelector = parent.kind.manifestKind === kuberesources.allKinds.service.manifestKind;
        if (serviceSelector && typeof labelSelector === 'object' && !Array.isArray(labelSelector) && Object.keys(labelSelector).length === 0) {
            return [];
        }
        const selector = serviceSelector ? { matchLabels: labelSelector } : labelSelector;
        const pods = await kubectlUtils.getPods(kubectl, selector, { namespace: parent.namespace });
        return pods.map((p) => ResourceNode.create(kuberesources.allKinds.pod, p.name, p.metadata, { podInfo: p }));
    }
};

export const hasSelectorLister = {
    async list(kubectl: Kubectl, kind: kuberesources.ResourceKind): Promise<ClusterExplorerNode[]> {
        const objects = await kubectlUtils.getResourceWithSelector(kind.abbreviation, kubectl);
        return objects.map((obj) => ResourceNode.create(kind, obj.name, obj.metadata, { labelSelector: obj.selector }));
    }
};
