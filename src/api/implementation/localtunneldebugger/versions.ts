import * as v1 from "./v1";
import { API } from "../../contract/api";
import { versionUnknown, available } from "../apiutils";
import { LocalTunnelDebugger } from "../../../components/localtunneldebugger/localtunneldebugger";

export function apiVersion(localDebugger: LocalTunnelDebugger, version: string): API<any> {
    switch (version) {
        case "v1": return available(v1.impl(localDebugger));
        default: return versionUnknown;
    }
}
