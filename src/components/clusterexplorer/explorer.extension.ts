import * as vscode from "vscode";
import { Kubectl } from "../../kubectl";
import { Host } from "../../host";

export interface ExplorerExtender<T> {
    contributesChildren(parent?: T): boolean;
    getChildren(kubectl: Kubectl, host: Host, parent?: T): Promise<T[]>;
}

export interface ExplorerUICustomizer<T> {
    customize(element: T, treeItem: vscode.TreeItem): true | Thenable<true>;
}
