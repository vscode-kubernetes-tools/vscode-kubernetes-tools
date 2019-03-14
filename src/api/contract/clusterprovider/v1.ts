// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/clusterprovider/v1.ts
// at all times.

export interface ClusterProviderV1 {
    register(clusterProvider: ClusterProviderV1.ClusterProvider): void;
    list(): ReadonlyArray<ClusterProviderV1.ClusterProvider>;
}

export namespace ClusterProviderV1 {

    export type ClusterProviderAction = 'create' | 'configure';

    export interface ClusterProvider {
        readonly id: string;
        readonly displayName: string;
        readonly supportedActions: ClusterProviderAction[];
        next(wizard: Wizard, action: ClusterProviderAction, message: any): void;
    }

    export interface Wizard {
        showPage(htmlBody: Sequence<string>): Promise<void>;
    }

    export interface Observable<T> {
        subscribe(observer: Observer<T>): void;
    }

    export interface Observer<T> {
        onNext(value: T): Promise<boolean>;
    }

    export type Sequence<T> = T | Thenable<T> | Observable<T>;
}
