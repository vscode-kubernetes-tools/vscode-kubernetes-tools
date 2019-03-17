// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/explorer-tree/v1.ts
// at all times.

import * as vscode from 'vscode';

export interface ClusterExplorerV1 {
    resolveCommandTarget(target?: any): ClusterExplorerV1.ClusterExplorerNode | undefined;
    registerNodeContributor(nodeContributor: ClusterExplorerV1.NodeContributor): void;
    refresh(): void;
}

export namespace ClusterExplorerV1 {
    export interface NodeContributor {
        contributesChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): boolean;
        getChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<Node[]>;
    }

    export interface Node {
        getChildren(): Promise<Node[]>;
        getTreeItem(): vscode.TreeItem;
    }

    export interface ClusterExplorerResourceNode {
        readonly nodeType: 'resource';
        readonly namespace: string | null;
        readonly resourceKind: ResourceKind;
        readonly name: string;
        readonly metadata?: any;
    }

    export interface ClusterExplorerGroupingFolderNode {
        readonly nodeType: 'folder.grouping';
    }

    export interface ClusterExplorerResourceFolderNode {
        readonly nodeType: 'folder.resource';
        readonly resourceKind: ResourceKind;
    }

    export interface ClusterExplorerContextNode {
        readonly nodeType: 'context';
        readonly name: string;
    }

    export interface ClusterExplorerConfigDataItemNode {
        readonly nodeType: 'configitem';
        readonly name: string;
    }

    export interface ClusterExplorerErrorNode {
        readonly nodeType: 'error';
    }

    export interface ClusterExplorerHelmReleaseNode {
        readonly nodeType: 'helm.release';
        readonly name: string;
    }

    export interface ClusterExplorerExtensionNode {
        readonly nodeType: 'extension';
    }

    export type ClusterExplorerNode =
        ClusterExplorerResourceNode |
        ClusterExplorerGroupingFolderNode |
        ClusterExplorerResourceFolderNode |
        ClusterExplorerContextNode |
        ClusterExplorerConfigDataItemNode |
        ClusterExplorerErrorNode |
        ClusterExplorerHelmReleaseNode |
        ClusterExplorerExtensionNode;

    export interface ResourceKind {
        readonly manifestKind: string;
        readonly abbreviation: string;
    }
}
