import { APIBroker, API } from "../contract/api";
import { versionUnknown } from "./apiutils";
import * as clusterprovider from "./clusterprovider/versions";
import * as kubectl from "./kubectl/versions";
import * as helm from "./helm/versions";
import * as clusterExplorer from "./cluster-explorer/versions";
import { ClusterProviderRegistry } from "../../components/clusterprovider/clusterproviderregistry";
import { Kubectl } from "../../kubectl";
import { KubernetesExplorer } from "../../explorer";

export function apiBroker(clusterProviderRegistry: ClusterProviderRegistry, kubectlImpl: Kubectl, explorer: KubernetesExplorer): APIBroker {
    return {
        get(component: string, version: string): API<any> {
            switch (component) {
                case "clusterprovider": return clusterprovider.apiVersion(clusterProviderRegistry, version);
                case "kubectl": return kubectl.apiVersion(kubectlImpl, version);
                case "helm": return helm.apiVersion(version);
                case "clusterexplorer": return clusterExplorer.apiVersion(explorer, version);
                default: return versionUnknown;
            }
        },

        // Backward compatibility
        apiVersion: '1.0',
        clusterProviderRegistry: clusterProviderRegistry
    };
}
