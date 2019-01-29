import { refreshExplorer } from '../clusterprovider/common/explorer';
import { promptKindName } from '../../extension';
import { host } from '../../host';
import * as kubectlUtils from '../../kubectlUtils';
import * as kuberesources from '../../kuberesources';
import * as explorer from '../../explorer';
import { Kubectl } from '../../kubectl';

export async function useNamespaceKubernetes(kubectl: Kubectl, explorerNode: explorer.KubernetesObject) {
    if (explorerNode) {
        if (await kubectlUtils.switchNamespace(kubectl, explorerNode.id)) {
            refreshExplorer();
            host.showInformationMessage(`Switched to namespace ${explorerNode.id}`);
            return;
        }
    }

    const currentNS = await kubectlUtils.currentNamespace(kubectl);
    promptKindName(
        [kuberesources.allKinds.namespace],
        undefined,
        {
            prompt: 'What namespace do you want to use?',
            placeHolder: 'Enter the namespace to switch to or press enter to select from available list',
            filterNames: [currentNS]
        },
        (kindName) => switchToNamespace(kubectl, currentNS, kindName)
    );
}

async function switchToNamespace (kubectl: Kubectl, currentNS: string, resource: string) {
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
