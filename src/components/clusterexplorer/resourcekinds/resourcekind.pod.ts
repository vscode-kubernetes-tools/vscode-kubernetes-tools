import * as vscode from 'vscode';

import { ResourceNode } from '../node.resource';
import { Kubectl } from '../../../kubectl';
import * as kubectlUtils from '../../../kubectlUtils';
import { ClusterExplorerNode } from '../node';
import { MessageNode } from '../node.message';
import { Pod } from '../../../kuberesources.objectmodel';
import { ResourceKind } from '../../../kuberesources';
import { assetUri } from '../../../assets';

export const podUICustomiser = {
    customiseTreeItem(resource: ResourceNode, treeItem: vscode.TreeItem): void {
        const podInfo = resource.extraInfo!.podInfo;  // TODO: unbang
        if (podInfo && podInfo.status) {
            treeItem.iconPath = getIconForPodStatus(podInfo.status.toLowerCase(), podInfo.ready);
        }
    }
};

// getIconForPodStatus takes status and ready values and returns an appropriate icon uri
// Currently, supported/expected status values are running, completed and init, other values return error condition.
// The expected value for "ready" is two digits, ready and total number of containers, which are separated by a "/" character.
function getIconForPodStatus(status: string, ready: string): vscode.Uri {
    console.log(status);
    if (status === "running") {
        const readyFields = ready.split("/", 2);
        if (readyFields[0] === readyFields[1]) {
            return assetUri("images/runningPod.svg");
        } else {
            return assetUri("images/notReadyPod.svg");
        }
    } else if (status === "completed") {
        return assetUri("images/completedPod.svg");
    } else if (status.startsWith("init")) {
        return assetUri("images/notReadyPod.svg");
    } else {
        return assetUri("images/errorPod.svg");
    }
}

export const podStatusChildSource = {
    async children(kubectl: Kubectl, parent: ResourceNode): Promise<ClusterExplorerNode[]> {
        const nsarg = parent.namespace ? `--namespace=${parent.namespace}` : '';
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
    async list(kubectl: Kubectl, kind: ResourceKind): Promise<ClusterExplorerNode[]> {
        const pods = await kubectlUtils.getPods(kubectl, null, null);
        return pods.map((pod) => ResourceNode.create(
            kind,
            pod.name,
            pod.metadata,
            { podInfo: pod }
        ));
    }
};
