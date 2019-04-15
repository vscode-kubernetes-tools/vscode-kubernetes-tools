import * as vscode from 'vscode';

export interface CloudExplorerProvider {
    readonly cloudName: string;
    readonly treeDataProvider: vscode.TreeDataProvider<any>;
    getKubeconfigYaml(cluster: any): Promise<string | undefined>;
}
