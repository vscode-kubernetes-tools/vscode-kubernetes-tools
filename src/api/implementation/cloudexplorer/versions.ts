import * as v1 from "./v1";
import { API } from "../../contract/api";
import { versionUnknown, available } from "../apiutils";
import { CloudExplorer } from "../../../components/cloudexplorer/cloudexplorer";

export function apiVersion(explorer: CloudExplorer, version: string): API<any> {
    switch (version) {
        case "v1": return available(v1.impl(explorer));
        default: return versionUnknown;
    }
}
