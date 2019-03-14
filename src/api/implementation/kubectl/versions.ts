import * as v1 from "./v1";
import { API } from "../../contract/api";
import { versionUnknown, available } from "../apiutils";
import { Kubectl } from "../../../kubectl";

export function apiVersion(kubectl: Kubectl, version: string): API<any> {
    switch (version) {
        case "v1": return available(v1.impl(kubectl));
        default: return versionUnknown;
    }
}
