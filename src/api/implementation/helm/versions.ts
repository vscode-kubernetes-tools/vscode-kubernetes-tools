import * as v1 from "./v1";
import { API } from "../../contract/api";
import { versionUnknown, available } from "../apiutils";

export function apiVersion(version: string): API<any> {
    switch (version) {
        case "v1": return available(v1.impl());
        default: return versionUnknown;
    }
}
