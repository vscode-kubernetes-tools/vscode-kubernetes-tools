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
