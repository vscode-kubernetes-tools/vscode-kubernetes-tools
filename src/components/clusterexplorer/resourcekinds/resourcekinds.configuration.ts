import { Kubectl } from "../../../kubectl";
import { ResourceNode } from "../node.resource";
import { ClusterExplorerNode } from "../node";
import { ConfigurationValueNode } from "../node.configurationvalue";

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
