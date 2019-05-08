import * as v1 from "./v1";
import { API } from "../../contract/api";
import { versionUnknown, available } from "../apiutils";
import { Kubectl } from "../../../kubectl";
import { PortForwardStatusBarManager } from "../../../components/kubectl/port-forward-ui";

export function apiVersion(kubectl: Kubectl, portForwardStatusBarManager: PortForwardStatusBarManager, version: string): API<any> {
    switch (version) {
        case "v1": return available(v1.impl(kubectl, portForwardStatusBarManager));
        default: return versionUnknown;
    }
}
