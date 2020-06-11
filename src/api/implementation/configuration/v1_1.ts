/* eslint-disable camelcase */
import { getKubeconfigPath } from '../../../components/kubectl/kubeconfig';
import { Event, EventEmitter } from 'vscode';
import { ActiveValueTracker } from "../../../components/contextmanager/active-value-tracker";
import { ConfigurationV1_1 } from "../../contract/configuration/v1_1";

export function impl(configPathChangedEmitter: EventEmitter<ConfigurationV1_1.KubeconfigPath>, activeContextTracker: ActiveValueTracker<string | null>): ConfigurationV1_1 {
    return new ConfigurationV1_1Impl(configPathChangedEmitter, activeContextTracker);
}

class ConfigurationV1_1Impl implements ConfigurationV1_1 {
    readonly onDidChangeKubeconfigPath: Event<ConfigurationV1_1.KubeconfigPath>;

    readonly onDidChangeContext: Event<string | null>;

    constructor(configPathChangedEmitter: EventEmitter<ConfigurationV1_1.KubeconfigPath>, activeContextTracker: ActiveValueTracker<string | null>) {
        this.onDidChangeKubeconfigPath = configPathChangedEmitter.event;
        this.onDidChangeContext = activeContextTracker.activeChanged;
    }


    getKubeconfigPath(): ConfigurationV1_1.KubeconfigPath {
        return getKubeconfigPath();
    }
}
