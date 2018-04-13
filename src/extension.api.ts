import * as clusterproviderregistry from './components/clusterprovider/clusterproviderregistry';
import { KubernetesExplorerDataProviderRegistry } from './explorer.api';

export interface ExtensionAPI {
    readonly apiVersion: string;
    readonly clusterProviderRegistry: clusterproviderregistry.ClusterProviderRegistry;
    readonly explorerDataProviderRegistry: KubernetesExplorerDataProviderRegistry;
}
