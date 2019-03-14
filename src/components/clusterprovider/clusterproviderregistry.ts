import { Wizard } from "../wizard/wizard";

export type ClusterProviderAction = 'create' | 'configure';

export interface ClusterProvider {
    readonly id: string;
    readonly displayName: string;
    readonly supportedActions: ClusterProviderAction[];
    next(w: Wizard, action: ClusterProviderAction, m: any): void;
}

export interface ClusterProviderRegistry {
    register(clusterProvider: ClusterProvider): void;
    list(): ReadonlyArray<ClusterProvider>;
}

class RegistryImpl implements ClusterProviderRegistry {
    private readonly providers = new Array<ClusterProvider>();

    public register(clusterProvider: ClusterProvider) {
        console.log(`You registered cluster type ${clusterProvider.id}`);
        this.providers.push(clusterProvider);
    }

    public list(): ReadonlyArray<ClusterProvider> {
        let copy = new Array<ClusterProvider>();
        copy = copy.concat(this.providers);
        return copy;
    }
}

const registryImpl = new RegistryImpl();

export function get(): ClusterProviderRegistry {
    return registryImpl;
}
