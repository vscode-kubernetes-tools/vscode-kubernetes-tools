import * as vscode from 'vscode';
import { refreshExplorer } from '../clusterprovider/common/explorer';
import { promptKindName } from '../../extension';
import { host } from '../../host';
import * as kubectlUtils from '../../kubectlUtils';
import * as kuberesources from '../../kuberesources';
import { Kubectl } from '../../kubectl';
import { ClusterExplorerNode } from '../clusterexplorer/node';
import { NODE_TYPES } from '../clusterexplorer/explorer';
import * as config from '../config/config';
import { KubernetesExplorer } from '../clusterexplorer/explorer';


export async function useNamespaceKubernetes(kubectl: Kubectl, explorerNode: ClusterExplorerNode) {
    if (explorerNode && explorerNode.nodeType === NODE_TYPES.resource) {
        if (await kubectlUtils.switchNamespace(kubectl, explorerNode.name)) {
            refreshExplorer();
            host.showInformationMessage(`Switched to namespace ${explorerNode.name}`);
            return;
        }
    }

    const isMinimalWorkflow = config.isMinimalWorkflow();
    const currentNS = await kubectlUtils.currentNamespace(kubectl);
    const kindName = await promptKindName(
        [kuberesources.allKinds.namespace],
        '',  // unused because options specify prompt
        {
            prompt: 'What namespace do you want to use?',
            placeHolder: 'Enter the namespace to switch to or press enter to select from available list',
            filterNames: [currentNS],
            skipFreeTextPrompt: isMinimalWorkflow
        }
    );

    if (kindName) {
        switchToNamespace(kubectl, currentNS, kindName);
    }
}

async function switchToNamespace(kubectl: Kubectl, currentNS: string, resource: string) {
    if (!resource) {
        return;
    }

    let toSwitchNamespace = resource;
    // resource will be of format <kind>/<name>, when picked up from the quickpick
    if (toSwitchNamespace.lastIndexOf('/') !== -1) {
        toSwitchNamespace = toSwitchNamespace.substring(toSwitchNamespace.lastIndexOf('/') + 1);
    }

    // Switch if an only if the currentNS and toSwitchNamespace are different
    if (toSwitchNamespace && currentNS !== toSwitchNamespace) {
        if (await kubectlUtils.switchNamespace(kubectl, toSwitchNamespace)) {
            refreshExplorer();
            host.showInformationMessage(`Switched to namespace ${toSwitchNamespace}`);
        }
    }
}

export async function showAccessibleNamespacesOnly(_kubectl: Kubectl, treeProvider: KubernetesExplorer, _explorerNode: ClusterExplorerNode) {
    // get cluster 
    const vsKubernetesConfig = vscode.workspace.getConfiguration('vs-kubernetes');
    const currentValue = vsKubernetesConfig['vs-kubernetes.hideInaccessibleNamespaces'] || false;
    
    await config.setConfigValue('vs-kubernetes.hideInaccessibleNamespaces', !currentValue);
    
    if (!currentValue) {
        host.showInformationMessage('Namespace filtering enabled. Refreshing tree view...');
    } else {
        host.showInformationMessage('Namespace filtering disabled. Showing all namespaces...');
    }
    
    // refresh to apply change
    treeProvider.refresh();
}