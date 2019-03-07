import * as v1 from "./v1";
import { API } from "../../contract/api";
import { versionUnknown, available } from "../apiutils";
import { ExplorerExtendable } from "../../../explorer.extension";
import { KubernetesObject } from "../../../explorer";

export function apiVersion(explorer: ExplorerExtendable<KubernetesObject>, version: string): API<any> {
    switch (version) {
        case "v1": return available(v1.impl(explorer));
        default: return versionUnknown;
    }
}
