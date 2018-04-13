import { KubernetesObject } from "./explorer";

export interface ExplorerDataProvider {
    getChildren(parent: KubernetesObject): Promise<KubernetesObject[]>;
}

export interface KubernetesExplorerDataProviderRegistry {
    register(dataProvider: ExplorerDataProvider): void;
    list(): Array<ExplorerDataProvider>;
}

class KubernetesExplorerDataProviderRegistryImpl implements KubernetesExplorerDataProviderRegistry {
    private readonly providers = new Array<ExplorerDataProvider>();

    register(dataProvider: ExplorerDataProvider): void {
        this.providers.push(dataProvider);
    }

    list(): Array<ExplorerDataProvider> {
        return [].concat(this.providers);
    }
}

export function createKubernetesExplorerRegistry(): KubernetesExplorerDataProviderRegistry {
    return new KubernetesExplorerDataProviderRegistryImpl();
}
