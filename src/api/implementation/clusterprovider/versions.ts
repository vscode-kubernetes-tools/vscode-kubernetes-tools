import * as v1 from "./v1";
import { API } from "../../contract/api";
import { versionUnknown, available } from "../apiutils";
import { ClusterProviderRegistry } from "../../../components/clusterprovider/clusterproviderregistry";

export function apiVersion(registry: ClusterProviderRegistry, version: string): API<any> {
    switch (version) {
        case "v1": return available(v1.impl(registry));
        default: return versionUnknown;
    }
}
