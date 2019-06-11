import * as path from 'path';
import * as vscode from 'vscode';

import { ResourceNode } from '../node.resource';
import { Kubectl } from '../../../kubectl';
import * as kubectlUtils from '../../../kubectlUtils';
import { ClusterExplorerNode } from '../node';
import { MessageNode } from '../node.message';
import { Pod } from '../../../kuberesources.objectmodel';
import { ResourceNodeInfo } from '../resourceui';

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

export const podStatusChildSource = {
    async children(kubectl: Kubectl, parent: ResourceNode): Promise<ClusterExplorerNode[]> {
        const nsarg = parent.namespace ? `--namespace=${parent.namespace}` : '';  // TODO: still not working!
        const result = await kubectl.asJson<Pod>(`get pods ${parent.name} ${nsarg} -o json`);
        if (result.succeeded) {
            const pod = result.result;
            let ready = 0;
            pod.status.containerStatuses.forEach((status) => {
                if (status.ready) {
                    ready++;
                }
            });
            return [
                new MessageNode(`${pod.status.phase} (${ready}/${pod.status.containerStatuses.length})`),
                new MessageNode(pod.status.podIP),
            ];
        }
        else {
            return [new MessageNode("Error", result.error[0])];
        }
    }
};

export const podLister = {
    async list(kubectl: Kubectl): Promise<ResourceNodeInfo[]> {
        const pods = await kubectlUtils.getPods(kubectl, null, null);
        return pods.map((pod) => ({
            name: pod.name,
            metadata: pod.metadata,
            extraInfo: { podInfo: pod }
        }));
    }
};
