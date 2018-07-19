export type ClusterProviderAction = 'create' | 'configure';

export interface ClusterProvider {
    readonly id: string;
    readonly displayName: string;
    readonly supportedActions: ClusterProviderAction[];
    serve(): Promise<number>;
}

export interface ClusterProviderRegistry {
    register(clusterProvider: ClusterProvider): void;
    list(): Array<ClusterProvider>;
}

class RegistryImpl implements ClusterProviderRegistry {
    private readonly providers = new Array<ClusterProvider>();

    public register(clusterProvider: ClusterProvider) {
        console.log(`You registered cluster type ${clusterProvider.id}`);
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
