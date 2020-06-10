import { ConfigurationV1 } from "../../contract/configuration/v1";
import { getKubeconfigPath } from '../../../components/kubectl/kubeconfig';
import { Event, EventEmitter } from 'vscode';
import { ActiveValueTracker } from "../../../components/contextmanager/active-value-tracker";

export function impl(configPathChangedEmitter: EventEmitter<ConfigurationV1.KubeconfigPath>, activeContextTracker: ActiveValueTracker<string | null>): ConfigurationV1 {
    return new ConfigurationV1Impl(configPathChangedEmitter, activeContextTracker);
}

class ConfigurationV1Impl implements ConfigurationV1 {

    onDidKubeconfigPathChange: Event<ConfigurationV1.KubeconfigPath>;

    onDidActiveContextChanged: Event<string | null>;

    constructor(configPathChangedEmitter: EventEmitter<ConfigurationV1.KubeconfigPath>, activeContextTracker: ActiveValueTracker<string | null>) {
        this.onDidKubeconfigPathChange = configPathChangedEmitter.event;
        this.onDidActiveContextChanged = activeContextTracker.activeChanged;
    }


    getKubeconfigPath(): ConfigurationV1.KubeconfigPath {
        return getKubeconfigPath();
    }
}
