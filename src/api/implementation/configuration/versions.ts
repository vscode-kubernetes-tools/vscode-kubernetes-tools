/* eslint-disable camelcase */

import * as v1 from "./v1";
import * as v1_1 from "./v1_1";
import { API } from "../../contract/api";
import { versionUnknown, available } from "../apiutils";
import { EventEmitter } from "vscode";
import { ActiveValueTracker } from "../../../components/contextmanager/active-value-tracker";
import { ConfigurationV1 } from "../../contract/configuration/v1";

export function apiVersion(version: string,
    onDidChangeKubeconfigEmitter: EventEmitter<ConfigurationV1.KubeconfigPath>,
    activeContextTracker: ActiveValueTracker<string | null>,
    onDidChangeNamespaceEmitter: EventEmitter<string>): API<any> {
    switch (version) {
        case "v1": return available(v1.impl());
        case "v1_1": return available(v1_1.impl(onDidChangeKubeconfigEmitter, activeContextTracker, onDidChangeNamespaceEmitter));
        default: return versionUnknown;
    }
}
