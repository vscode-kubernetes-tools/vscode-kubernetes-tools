import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { ClusterExplorerResourceNode } from '../clusterexplorer/node';

export enum EventDisplayMode {
    Show,
    Follow
}

export async function getEvents(kubectl: Kubectl, displayMode: EventDisplayMode, explorerNode?: ClusterExplorerResourceNode) {
    let eventsNS;

    if (explorerNode) {
        eventsNS = explorerNode.name;
    } else {
        eventsNS = await kubectlUtils.currentNamespace(kubectl);
    }

    let cmd = `get events --namespace ${eventsNS}`;

    if (displayMode === EventDisplayMode.Follow) {
        cmd += ' -w';
        return kubectl.invokeInNewTerminal(cmd, 'Kubernetes Events');
    } else {
        return kubectl.invokeInSharedTerminal(cmd);
    }
}
