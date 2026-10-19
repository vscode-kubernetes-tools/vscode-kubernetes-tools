import { ThemeIcon } from 'vscode';
import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { ClusterExplorerResourceNode } from '../clusterexplorer/node';
import { INVALID_KUBERNETES_IDENTIFIER_MESSAGE, isValidNamespaceName } from '../../utils/kubernetes-identifiers';
import { host } from '../../host';

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

    if (!isValidNamespaceName(eventsNS)) {
        host.showErrorMessage(INVALID_KUBERNETES_IDENTIFIER_MESSAGE);
        return;
    }

    const args = ['get', 'events', '--namespace', eventsNS];

    if (displayMode === EventDisplayMode.Follow) {
        args.push('-w');
        return kubectl.invokeInNewTerminal(args, 'Kubernetes Events', undefined, new ThemeIcon('bell'));
    } else {
        return kubectl.invokeInSharedTerminal(args);
    }
}
