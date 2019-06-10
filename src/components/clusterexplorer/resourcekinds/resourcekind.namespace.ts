import * as vscode from 'vscode';

import { ResourceNode } from '../node.resource';

export const namespaceUICustomiser = {
    customiseTreeItem(resource: ResourceNode, treeItem: vscode.TreeItem): void {
        const namespaceInfo = resource.extraInfo!.namespaceInfo!;  // TODO: unbang
        if (namespaceInfo.active) {
            treeItem.label = "* " + treeItem.label;
        }
        else {
            treeItem.contextValue += ".inactive";
        }
    }
};
