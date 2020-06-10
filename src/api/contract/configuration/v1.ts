// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/configuration/v1.ts
// at all times.

import { Event } from 'vscode';

export interface ConfigurationV1 {
    getKubeconfigPath(): ConfigurationV1.KubeconfigPath;

    onDidKubeconfigPathChange: Event<ConfigurationV1.KubeconfigPath>;

    onDidActiveContextChanged: Event<string | null>;
}

export namespace ConfigurationV1 {

    export interface HostKubeconfigPath {
        readonly pathType: 'host';
        readonly hostPath: string;
    }

    export interface WSLKubeconfigPath {
        readonly pathType: 'wsl';
        readonly wslPath: string;
    }

    export type KubeconfigPath = HostKubeconfigPath | WSLKubeconfigPath;

}
