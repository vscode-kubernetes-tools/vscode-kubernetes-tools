import { Kubectl } from './kubectl';
import * as kubectlUtils from './kubectlUtils';
import * as explorer from './explorer';

export enum EventDisplayMode {
    Show,
    Follow
}

export async function getEvents(kubectl: Kubectl, displayMode: EventDisplayMode, explorerNode?: explorer.ResourceNode) {
    let eventsNS;

    if (explorerNode) {
        eventsNS = explorerNode.id;
    } else {
        eventsNS = await kubectlUtils.currentNamespace(kubectl);
    }

    let cmd = `get events --namespace ${eventsNS}`;

    if (EventDisplayMode.Follow === displayMode) {
        cmd += ' -w';
        return kubectl.invokeInNewTerminal(cmd, 'Kubernetes Events');
    }else{
        return kubectl.invokeInSharedTerminal(cmd);
    }
}
