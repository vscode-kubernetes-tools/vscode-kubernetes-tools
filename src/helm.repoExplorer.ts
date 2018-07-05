import * as vscode from 'vscode';

import { Host } from './host';

export function create(host: Host): HelmRepoExplorer {
    return new HelmRepoExplorer(host);
}

export class HelmRepoExplorer implements vscode.TreeDataProvider<any> {
    private onDidChangeTreeDataEmitter: vscode.EventEmitter<any | undefined> = new vscode.EventEmitter<any | undefined>();
    readonly onDidChangeTreeData: vscode.Event<any | undefined> = this.onDidChangeTreeDataEmitter.event;

    constructor(private readonly host: Host) {
        host.onDidChangeConfiguration((change) => {
            if (change.affectsConfiguration('vs-kubernetes')) {
                this.refresh();
            }
        });
    }

    getTreeItem(element: any): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return new vscode.TreeItem("placeholder");
    }

    getChildren(parent?: any): vscode.ProviderResult<any[]> {
        return [];
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }
}
