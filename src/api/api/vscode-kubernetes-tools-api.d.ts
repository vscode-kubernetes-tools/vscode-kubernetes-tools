declare module "vscode-kubernetes-tools-api" {

    export interface APIBroker {
        api(requested: APIRequest): APIVersion;
    }
    
    export interface APIRequest {
        component: string;
        version: string;
    }
    
    export interface AvailableAPIVersion {
        readonly succeeded: true;
        readonly api: any;
    }
    
    // We prefer this to an enum because there is less chance of a new
    // entry accidentally changing the values.
    export type UnavailableAPIVersionReason =
        'APIVersionNoLongerSupported' |
        'APIVersionUnknownInThisExtensionVersion' |
        'APIComponentUnknownInThisExtensionVersion';
    
    export interface UnavailableAPIVersion {
        readonly succeeded: false;
        readonly reason: UnavailableAPIVersionReason;
    }
    
    export type APIVersion = AvailableAPIVersion | UnavailableAPIVersion;

    export const clusterProviderComponentId = 'clusterprovider';
}

declare module "vscode-kubernetes-tools-api.clusterprovider.v1" {

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

}
