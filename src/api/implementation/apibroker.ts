import { APIBroker, API } from "../contract/api";
import { versionUnknown } from "./apiutils";
import * as clusterprovider from "./clusterprovider/versions";
import { ClusterProviderRegistry } from "../../components/clusterprovider/clusterproviderregistry";

export function apiBroker(clusterProviderRegistry: ClusterProviderRegistry): APIBroker {
    return {
        get(component: string, version: string): API<any> {
            switch (component) {
                case "clusterprovider": return clusterprovider.apiVersion(clusterProviderRegistry, version);
                default: return versionUnknown;
            }
        },

        // Backward compatibility
        apiVersion: '1.0',
        clusterProviderRegistry: clusterProviderRegistry
    };
}
