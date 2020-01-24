// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/configuration/v1.ts
// at all times.

export interface ConfigurationV1 {
    getKubeconfigPath(): ConfigurationV1.HostedKubeconfig | ConfigurationV1.GuestKubeconfig;
}

export namespace ConfigurationV1 {

    export interface HostedKubeconfig {
        readonly isHostPath: true;
        path: string;
    }

    export interface GuestKubeconfig {
        readonly isHostPath: false;
        readonly guestPathType: 'wsl';
        guestPath: string;
    }
}
