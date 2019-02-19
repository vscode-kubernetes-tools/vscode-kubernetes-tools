import { ClusterProviderV1 } from "../../contract/clusterprovider/v1";
import { ClusterProviderRegistry } from "../../../components/clusterprovider/clusterproviderregistry";

export function impl(registry: ClusterProviderRegistry): ClusterProviderV1 {
    return new ClusterProviderV1Impl(registry);
}

class ClusterProviderV1Impl implements ClusterProviderV1 {
    constructor(private readonly registry: ClusterProviderRegistry) {}

    async register(clusterProvider: ClusterProviderV1.ClusterProvider): Promise<void> {
        this.registry.register(clusterProvider);
    }

    list(): ReadonlyArray<ClusterProviderV1.ClusterProvider> {
        return this.registry.list();
    }
}
