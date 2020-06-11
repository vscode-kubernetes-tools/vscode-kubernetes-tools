
// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/configuration/v1_1.ts
// at all times.

import { Event } from 'vscode';

/* eslint-disable camelcase */

export interface ConfigurationV1_1 {
    getKubeconfigPath(): ConfigurationV1_1.KubeconfigPath;

    readonly onDidChangeKubeconfigPath: Event<ConfigurationV1_1.KubeconfigPath>;

    readonly onDidChangeContext: Event<string | null>;
}

export namespace ConfigurationV1_1 {

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

