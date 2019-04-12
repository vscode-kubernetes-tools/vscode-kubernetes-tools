import * as vscode from 'vscode';

export interface CloudExplorerProvider {
    readonly cloudName: string;
    readonly treeDataProvider: vscode.TreeDataProvider<any>;
}
