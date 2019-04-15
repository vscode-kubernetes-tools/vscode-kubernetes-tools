import { CloudExplorerV1 } from "../../contract/cloudexplorer/v1";
import { CloudExplorer, CloudExplorerTreeNode } from '../../../components/cloudexplorer/cloudexplorer';

export function impl(explorer: CloudExplorer): CloudExplorerV1 {
    return new CloudExplorerV1Impl(explorer);
}

class CloudExplorerV1Impl implements CloudExplorerV1 {
    constructor(private readonly explorer: CloudExplorer) {}

    registerCloudProvider(cloudProvider: CloudExplorerV1.CloudProvider): void {
        this.explorer.register(cloudProvider);
    }

    resolveCommandTarget(target?: any): CloudExplorerV1.CloudExplorerNode | undefined {
        if (!target) {
            return undefined;
        }

        const node = target as CloudExplorerTreeNode;
        if (node.nodeType === 'cloud') {
            return {
                nodeType: 'cloud',
                cloudName: node.provider.cloudName
            };
        } else  if (node.nodeType === 'contributed') {
            return {
                nodeType: 'resource',
                cloudName: node.provider.cloudName,
                cloudResource: node.value
            };
        }

        return undefined;
    }

    refresh(): void {
        this.explorer.refresh();
    }
}
