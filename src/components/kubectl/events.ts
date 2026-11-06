import * as vscode from 'vscode';
import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { ClusterExplorerResourceNode } from '../clusterexplorer/node';
import { eventsArgs } from './log-command';

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

    const args = eventsArgs(eventsNS, displayMode === EventDisplayMode.Follow);
    if (!args) {
        await vscode.window.showErrorMessage('Invalid Kubernetes Events namespace.');
        return;
    }
    return kubectl.invokeArgsInOutputTerminal(args, 'Kubernetes Events');
}
