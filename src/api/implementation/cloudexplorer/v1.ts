import { CloudExplorerV1 } from "../../contract/cloudexplorer/v1";
import { CloudExplorer } from '../../../components/cloudexplorer/cloudexplorer';

export function impl(explorer: CloudExplorer): CloudExplorerV1 {
    return new CloudExplorerV1Impl(explorer);
}

class CloudExplorerV1Impl implements CloudExplorerV1 {
    constructor(private readonly explorer: CloudExplorer) {}

    registerCloudProvider(cloudProvider: CloudExplorerV1.CloudProvider): void {
        this.explorer.register(cloudProvider);
    }

    refresh(): void {
        this.explorer.refresh();
    }
}
