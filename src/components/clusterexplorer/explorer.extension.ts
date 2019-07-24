import * as vscode from "vscode";

export interface ExplorerExtender<T> {
    contributesChildren(parent?: T): boolean;
    getChildren(parent?: T): Promise<T[]>;
}

export interface ExplorerUICustomizer<T> {
    customize(element: T, treeItem: vscode.TreeItem): true | Thenable<true>;
}
