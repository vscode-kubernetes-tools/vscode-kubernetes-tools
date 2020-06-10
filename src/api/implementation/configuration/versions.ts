import * as v1 from "./v1";
import { API } from "../../contract/api";
import { versionUnknown, available } from "../apiutils";
import { EventEmitter } from "vscode";
import { ActiveValueTracker } from "../../../components/contextmanager/active-value-tracker";
import { ConfigurationV1 } from "../../contract/configuration/v1";

export function apiVersion(version: string, configPathChangedEmitter: EventEmitter<ConfigurationV1.KubeconfigPath>, activeContextTracker: ActiveValueTracker<string | null>): API<any> {
    switch (version) {
        case "v1": return available(v1.impl(configPathChangedEmitter, activeContextTracker));
        default: return versionUnknown;
    }
}
