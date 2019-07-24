import * as v1 from "./v1";
import { API } from "../../contract/api";
import { versionUnknown, available } from "../apiutils";
import { KubernetesExplorer } from "../../../components/clusterexplorer/explorer";

export function apiVersion(explorer: KubernetesExplorer, version: string): API<any> {
    switch (version) {
        case "v1": return available(v1.impl(explorer));
        default: return versionUnknown;
    }
}
