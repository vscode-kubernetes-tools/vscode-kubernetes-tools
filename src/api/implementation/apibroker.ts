import { APIBroker, API } from "../contract/api";
import { versionUnknown } from "./apiutils";
import * as clusterprovider from "./clusterprovider/versions";
import * as kubectl from "./kubectl/versions";
import * as helm from "./helm/versions";
import * as clusterexplorer from "./cluster-explorer/versions";
import * as cloudexplorer from "./cloudexplorer/versions";
import * as configuration from "./configuration/versions";
import * as localtunneldebugger from "./localtunneldebugger/versions";
import { ClusterProviderRegistry } from "../../components/clusterprovider/clusterproviderregistry";
import { Kubectl } from "../../kubectl";
import { KubernetesExplorer } from "../../components/clusterexplorer/explorer";
import { CloudExplorer } from "../../components/cloudexplorer/cloudexplorer";
import { PortForwardStatusBarManager } from "../../components/kubectl/port-forward-ui";
import { LocalTunnelDebugger } from "../../components/localtunneldebugger/localtunneldebugger";

export function apiBroker(clusterProviderRegistry: ClusterProviderRegistry, kubectlImpl: Kubectl, portForwardStatusBarManager: PortForwardStatusBarManager, 
    explorer: KubernetesExplorer, cloudExplorer: CloudExplorer, localTunnelDebugger: LocalTunnelDebugger): APIBroker {
    return {
        get(component: string, version: string): API<any> {
            switch (component) {
                case "clusterprovider": return clusterprovider.apiVersion(clusterProviderRegistry, version);
                case "kubectl": return kubectl.apiVersion(kubectlImpl, portForwardStatusBarManager, version);
                case "helm": return helm.apiVersion(version);
                case "clusterexplorer": return clusterexplorer.apiVersion(explorer, version);
                case "cloudexplorer": return cloudexplorer.apiVersion(cloudExplorer, version);
                case "localtunneldebugger": return localtunneldebugger.apiVersion(localTunnelDebugger, version);
                case "configuration": return configuration.apiVersion(version);
                default: return versionUnknown;
            }
        },

        // Backward compatibility
        apiVersion: '1.0',
        clusterProviderRegistry: clusterProviderRegistry
    };
}
