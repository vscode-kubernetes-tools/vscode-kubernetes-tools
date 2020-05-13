// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/explorer-tree/v1_1.ts
// at all times.

/* eslint-disable camelcase */

import * as vscode from 'vscode';

export interface ClusterExplorerV1_1 {
    resolveCommandTarget(target?: any): ClusterExplorerV1_1.ClusterExplorerNode | undefined;
    registerNodeContributor(nodeContributor: ClusterExplorerV1_1.NodeContributor): void;
    readonly nodeSources: ClusterExplorerV1_1.NodeSources;
    registerNodeUICustomizer(nodeUICustomizer: ClusterExplorerV1_1.NodeUICustomizer): void;
    refresh(): void;
}

export namespace ClusterExplorerV1_1 {
    export interface NodeContributor {
        contributesChildren(parent: ClusterExplorerNode | undefined): boolean;
        getChildren(parent: ClusterExplorerNode | undefined): Promise<Node[]>;
    }

    export interface NodeUICustomizer {
        customize(node: ClusterExplorerNode, treeItem: vscode.TreeItem): void | Thenable<void>;
    }

    export interface Node {
        getChildren(): Promise<Node[]>;
        getTreeItem(): vscode.TreeItem;
    }

    export interface ClusterExplorerResourceNode {
        readonly nodeType: 'resource';
        readonly namespace: string;
        readonly resourceKind: ResourceKind;
        readonly name: string;
        readonly metadata: object;
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

    // NOTE: It may seem odd to surface inactive contexts as a different node type,
    // rather than a property on CEContextNode. The reason is the adding nodes
    // scenario - typically authors want to add nodes *only* under the active context.
    // With a property, forgetting to check would result in incorrect behaviour in the
    // common case. This way, the common case works naturally and they need to opt in
    // to say 'no I really do want to add nodes to inactive clusters too'.
    export interface ClusterExplorerInactiveContextNode {
        readonly nodeType: 'context.inactive';
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

    export interface ClusterExplorerHelmHistoryNode {
        readonly nodeType: 'helm.history';
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
        ClusterExplorerInactiveContextNode |
        ClusterExplorerConfigDataItemNode |
        ClusterExplorerErrorNode |
        ClusterExplorerHelmReleaseNode |
        ClusterExplorerHelmHistoryNode |
        ClusterExplorerExtensionNode;

    export interface ResourceKind {
        readonly manifestKind: string;
        readonly abbreviation: string;
    }

    export interface NodeSource {
        at(parentFolder: string | undefined): NodeContributor;
        if(condition: () => boolean | Thenable<boolean>): NodeSource;
        nodes(): Promise<Node[]>;
    }

    export interface NodeSources {
        resourceFolder(displayName: string, pluralDisplayName: string, manifestKind: string, abbreviation: string, apiName?: string): NodeSource;
        groupingFolder(displayName: string, contextValue: string | undefined, ...children: NodeSource[]): NodeSource;
    }
}
