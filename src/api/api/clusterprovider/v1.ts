export const versionId = '1.0';

export type ClusterProviderAction = 'create' | 'configure';

export interface ClusterProvider {
    readonly id: string;
    readonly displayName: string;
    readonly supportedActions: ClusterProviderAction[];
    serve(): Promise<number>;
}

export interface ClusterProviderRegistry {
    register(provider: ClusterProvider): void;
}

export interface API {
    clusterProviderRegistry(): ClusterProviderRegistry;
}
