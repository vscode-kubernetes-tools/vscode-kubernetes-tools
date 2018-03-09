import * as clusterproviderregistry from './components/clusterprovider/clusterproviderregistry';

export interface ExtensionAPI {
    readonly apiVersion: string;
    readonly clusterProviderRegistry: clusterproviderregistry.ClusterProviderRegistry;
}
