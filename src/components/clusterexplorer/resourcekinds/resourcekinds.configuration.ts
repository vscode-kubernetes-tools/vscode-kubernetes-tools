import { Kubectl } from "../../../kubectl";
import * as kubectlUtils from '../../../kubectlUtils';
import { ResourceNode } from "../node.resource";
import { ClusterExplorerNode } from "../node";
import { ConfigurationValueNode } from "../node.configurationvalue";
import { ResourceNodeInfo } from "../resourceui";
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
    async list(kubectl: Kubectl, kind: ResourceKind): Promise<ResourceNodeInfo[]> {
        const resources = await kubectlUtils.getAsDataResources(kind.abbreviation, kubectl);
        return resources.map((r) => ({ name: r.metadata.name, metadata: r.metadata, extraInfo: { configData: r.data } }));
    }
};
