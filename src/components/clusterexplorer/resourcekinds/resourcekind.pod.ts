import * as path from 'path';
import * as vscode from 'vscode';

import { ResourceNode } from '../node.resource';

export const podUICustomiser = {
    customiseTreeItem(resource: ResourceNode, treeItem: vscode.TreeItem): void {
        const podInfo = resource.extraInfo!.podInfo!;  // TODO: unbang
        if (podInfo && podInfo.status) {
            treeItem.iconPath = getIconForPodStatus(podInfo.status.toLowerCase());
        }
    }
};

function getIconForPodStatus(status: string): vscode.Uri {
    if (status === "running" || status === "completed") {
        return vscode.Uri.file(path.join(__dirname, "../../../../../images/runningPod.svg"));
    } else {
        return vscode.Uri.file(path.join(__dirname, "../../../../../images/errorPod.svg"));
    }
}
