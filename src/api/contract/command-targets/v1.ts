// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/command-targets/v1.ts
// at all times.

export interface CommandTargetsV1 {
    resolve(target?: any): CommandTargetsV1.CommandTarget | undefined;
}

export namespace CommandTargetsV1 {

    export interface KubernetesExplorerNode {
        readonly targetType: 'kubernetes-explorer-node';
        readonly id: string;
    }

    export interface HelmExplorerNode {
        readonly targetType: 'helm-explorer-node';
    }

    export type CommandTarget = KubernetesExplorerNode | HelmExplorerNode;
}
