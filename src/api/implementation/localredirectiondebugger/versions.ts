import * as v1 from "./v1";
import { API } from "../../contract/api";
import { versionUnknown, available } from "../apiutils";
import { LocalRedirectionDebugger } from "../../../components/localRedirectionDebugger/localredirectiondebugger";

export function apiVersion(localDebugger: LocalRedirectionDebugger, version: string): API<any> {
    switch (version) {
        case "v1": return available(v1.impl(localDebugger));
        default: return versionUnknown;
    }
}
