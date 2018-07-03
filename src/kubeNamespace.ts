import { refreshExplorer, promptKindName, kubectl } from './extension';
import * as kubectlUtils from './kubectlUtils';
import * as kuberesources from './kuberesources';
import * as explorer from './explorer';

export async function useNamespaceKubernetes(explorerNode: explorer.KubernetesObject) {
    if (explorerNode) {
        if (await kubectlUtils.switchNamespace(kubectl, explorerNode.id)) {
            refreshExplorer();
            return;
        }
    } else {
        const currentNS = await kubectlUtils.currentNamespace(kubectl);
        promptKindName([kuberesources.allKinds.namespace], undefined,
            {
                prompt: 'What namespace do you want to use?',
                placeHolder: 'Enter the namespace to switch to or press enter to select from available list',
                filterNames: [currentNS]
            },
            async (resource) => {
                if (resource) {
                    let toSwitchNamespace = resource;
                    // resource will be of format <kind>/<name>, when picked up from the quickpick
                    if (toSwitchNamespace.lastIndexOf('/') !== -1) {
                        toSwitchNamespace = toSwitchNamespace.substring(toSwitchNamespace.lastIndexOf('/') + 1);
                    }
                    // Switch if an only if the currentNS and toSwitchNamespace are different
                    if (toSwitchNamespace && currentNS !== toSwitchNamespace) {
                        const promiseSwitchNS = await kubectlUtils.switchNamespace(kubectl, toSwitchNamespace);
                        if (promiseSwitchNS) {
                            refreshExplorer();
                        }
                    }
                }
            });
    }
}
