import { Kubectl } from "../../../kubectl";
import * as kubectlUtils from '../../../kubectlUtils';
import { ResourceNode } from "../node.resource";
import { ClusterExplorerNode } from "../node";
import { ConfigurationValueNode } from "../node.configurationvalue";
import { ResourceKind } from "../../../kuberesources";

export const configItemsChildSource = {
    async children(_kubectl: Kubectl, parent: ResourceNode): Promise<ClusterExplorerNode[]> {
        const configData = parent.extraInfo!.configData;  // TODO: unbang
        if (!configData || configData.length === 0) {
            return [];
        }
        const files = Object.keys(configData);
        return files.map((f) => new ConfigurationValueNode(configData, f, parent.kind, parent.name));
    }
};

export const configResourceLister = {
    async list(kubectl: Kubectl, kind: ResourceKind): Promise<ClusterExplorerNode[]> {
        const resources = await kubectlUtils.getAsDataResources(kind.abbreviation, kubectl);
        return resources.map((r) => ResourceNode.create(kind, r.metadata.name, r.metadata, { configData: r.data }));
    }
};
