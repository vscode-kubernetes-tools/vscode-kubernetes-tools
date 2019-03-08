import { APIBroker, API } from "../contract/api";
import { versionUnknown } from "./apiutils";
import * as clusterprovider from "./clusterprovider/versions";
import * as kubectl from "./kubectl/versions";
import * as commandTargets from "./command-targets/versions";
import * as explorerTree from "./explorer-tree/versions";
import { ClusterProviderRegistry } from "../../components/clusterprovider/clusterproviderregistry";
import { Kubectl } from "../../kubectl";
import { KubernetesExplorer } from "../../explorer";

export function apiBroker(clusterProviderRegistry: ClusterProviderRegistry, kubectlImpl: Kubectl, explorer: KubernetesExplorer): APIBroker {
    return {
        get(component: string, version: string): API<any> {
            switch (component) {
                case "clusterprovider": return clusterprovider.apiVersion(clusterProviderRegistry, version);
                case "kubectl": return kubectl.apiVersion(kubectlImpl, version);
                case "commandtargets": return commandTargets.apiVersion(version);
                case "explorertree": return explorerTree.apiVersion(explorer, version);
                default: return versionUnknown;
            }
        },

        // Backward compatibility
        apiVersion: '1.0',
        clusterProviderRegistry: clusterProviderRegistry
    };
}
