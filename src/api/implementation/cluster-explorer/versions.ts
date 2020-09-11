/* eslint-disable camelcase */

import * as v1 from "./v1";
import * as v1_1 from "./v1_1";
import * as v1_2 from "./v1_2";
import { API } from "../../contract/api";
import { versionUnknown, available } from "../apiutils";
import { KubernetesExplorer } from "../../../components/clusterexplorer/explorer";

export function apiVersion(explorer: KubernetesExplorer, version: string): API<any> {
    switch (version) {
        case "v1": return available(v1.impl(explorer));
        case "v1_1": return available(v1_1.impl(explorer));
        case "v1_2": return available(v1_2.impl(explorer));
        default: return versionUnknown;
    }
}
