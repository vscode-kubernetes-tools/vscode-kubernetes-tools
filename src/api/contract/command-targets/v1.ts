// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/command-targets/v1.ts
// at all times.

export interface CommandTargetsV1 {
    resolve(target?: any): CommandTargetsV1.CommandTarget | undefined;
}

export namespace CommandTargetsV1 {

    interface KubernetesExplorerNodeBase {
        readonly targetType: 'kubernetes-explorer-node';
    }

    export interface KubernetesExplorerResourceNode extends KubernetesExplorerNodeBase {
        readonly nodeType: 'resource';
        readonly namespace: string | null;
        readonly resourceId: string;
        readonly metadata?: any;
    }

    export interface KubernetesExplorerGroupingFolderNode extends KubernetesExplorerNodeBase {
        readonly nodeType: 'folder.grouping';
    }

    export interface KubernetesExplorerResourceFolderNode extends KubernetesExplorerNodeBase {
        readonly nodeType: 'folder.resource';
        readonly resourceKind: string;
    }

    export interface KubernetesExplorerContextNode extends KubernetesExplorerNodeBase {
        readonly nodeType: 'context';
    }

    export interface KubernetesExplorerNamespaceNode extends KubernetesExplorerNodeBase {
        readonly nodeType: 'namespace';
    }

    export interface KubernetesExplorerConfigDataItemNode extends KubernetesExplorerNodeBase {
        readonly nodeType: 'configitem';
    }

    export interface KubernetesExplorerErrorNode extends KubernetesExplorerNodeBase {
        readonly nodeType: 'error';
    }

    export interface KubernetesExplorerHelmReleaseNode extends KubernetesExplorerNodeBase {
        readonly nodeType: 'helm.release';
    }

    export type KubernetesExplorerNode =
        KubernetesExplorerResourceNode |
        KubernetesExplorerGroupingFolderNode |
        KubernetesExplorerResourceFolderNode |
        KubernetesExplorerContextNode |
        KubernetesExplorerNamespaceNode |
        KubernetesExplorerErrorNode |
        KubernetesExplorerHelmReleaseNode;

    export interface HelmExplorerNode {
        readonly targetType: 'helm-explorer-node';
    }

    export type CommandTarget = KubernetesExplorerNodeBase | HelmExplorerNode;
}
