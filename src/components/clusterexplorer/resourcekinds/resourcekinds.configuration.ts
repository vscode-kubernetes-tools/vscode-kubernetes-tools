import { Kubectl } from "../../../kubectl";
import * as kubectlUtils from '../../../kubectlUtils';
import { ResourceNode } from "../node.resource";
import { ClusterExplorerNode } from "../node";
import { ConfigurationValueNode } from "../node.configurationvalue";
import { ResourceKind } from "../../../kuberesources";

export const configItemsChildSource = {
    async children(_kubectl: Kubectl, parent: ResourceNode): Promise<ClusterExplorerNode[]> {
        const resource = await kubectlUtils.getAsDataResource(parent.name, parent.kind.abbreviation, _kubectl);
        if (!resource || Object.keys(resource).length === 0 || Object.keys(resource.data).length === 0) {
            return [];
        }
        const files = Object.keys(resource.data);
        return files.map((f) => new ConfigurationValueNode(resource.data, f, parent.kind, parent.name));
    }
};

export const configResourceLister = {
    async list(kubectl: Kubectl, kind: ResourceKind): Promise<ClusterExplorerNode[]> {
        const resources = await kubectlUtils.getAsDataResources(kind.abbreviation, kubectl);
        return resources.map((r) => ResourceNode.create(kind, r.metadata.name, r.metadata, { configData: r.data }));
    }
};
