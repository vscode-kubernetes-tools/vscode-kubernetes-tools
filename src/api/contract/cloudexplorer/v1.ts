// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/cloudexplorer/v1.ts
// at all times.

import * as vscode from 'vscode';

export interface CloudExplorerV1 {
    registerCloudProvider(cloudProvider: CloudExplorerV1.CloudProvider): void;
    resolveCommandTarget(target?: any): CloudExplorerV1.CloudExplorerNode | undefined;
    refresh(): void;
}

export namespace CloudExplorerV1 {
    export interface CloudProvider {
        readonly cloudName: string;
        readonly treeDataProvider: vscode.TreeDataProvider<any>;
        getKubeconfigYaml(cluster: any): Promise<string | undefined>;
    }

    export interface CloudExplorerCloudNode {
        readonly nodeType: 'cloud';
        readonly cloudName: string;
    }

    export interface CloudExplorerResourceNode {
        readonly nodeType: 'resource';
        readonly cloudName: string;
        readonly cloudResource: any;
    }

    export type CloudExplorerNode = CloudExplorerCloudNode | CloudExplorerResourceNode;
}
