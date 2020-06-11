/* eslint-disable camelcase */
import { getKubeconfigPath } from '../../../components/kubectl/kubeconfig';
import { Event, EventEmitter } from 'vscode';
import { ActiveValueTracker } from "../../../components/contextmanager/active-value-tracker";
import { ConfigurationV1_1 } from "../../contract/configuration/v1_1";

export function impl(onDidChangeKubeconfigEmitter: EventEmitter<ConfigurationV1_1.KubeconfigPath>,
    activeContextTracker: ActiveValueTracker<string | null>,
    onDidChangeNamespaceEmitter: EventEmitter<string>): ConfigurationV1_1 {
    return new ConfigurationV1_1Impl(onDidChangeKubeconfigEmitter, activeContextTracker, onDidChangeNamespaceEmitter);
}

class ConfigurationV1_1Impl implements ConfigurationV1_1 {
    readonly onDidChangeKubeconfigPath: Event<ConfigurationV1_1.KubeconfigPath>;
    readonly onDidChangeContext: Event<string | null>;
    readonly onDidChangeNamespace: Event<string>;

    constructor(onDidChangeKubeconfigEmitter: EventEmitter<ConfigurationV1_1.KubeconfigPath>,
        activeContextTracker: ActiveValueTracker<string | null>,
        onDidChangeNamespaceEmitter: EventEmitter<string>) {
        this.onDidChangeKubeconfigPath = onDidChangeKubeconfigEmitter.event;
        this.onDidChangeContext = activeContextTracker.activeChanged;
        this.onDidChangeNamespace = onDidChangeNamespaceEmitter.event;
    }


    getKubeconfigPath(): ConfigurationV1_1.KubeconfigPath {
        return getKubeconfigPath();
    }
}
