export type ClusterProviderAction = 'create' | 'configure';

export interface ClusterProvider {
    readonly id: string;
    readonly displayName: string;
    readonly port: number;
    readonly supportedActions: ClusterProviderAction[];
}

export interface ClusterProviderRegistry {
    register(clusterProvider: ClusterProvider): void;
    list(): Array<ClusterProvider>;
}

class RegistryImpl implements ClusterProviderRegistry {
    private readonly providers = new Array<ClusterProvider>();

    public register(clusterProvider: ClusterProvider) {
        console.log(`You registered ${clusterProvider.id} for port ${clusterProvider.port}`);
        this.providers.push(clusterProvider);
    }

    public list(): Array<ClusterProvider> {
        let copy = new Array<ClusterProvider>();
        copy = copy.concat(this.providers);
        return copy;
    }
}

const registryImpl = new RegistryImpl();

export function get(): ClusterProviderRegistry {
    return registryImpl;
}
