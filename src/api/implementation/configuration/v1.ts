import { ConfigurationV1 } from "../../contract/configuration/v1";
import { getKubeconfigPath } from '../../../components/kubectl/kubeconfig';

export function impl(): ConfigurationV1 {
    return new ConfigurationV1Impl();
}

class ConfigurationV1Impl implements ConfigurationV1 {
    getKubeconfigPath(): ConfigurationV1.KubeconfigPath  {
        return getKubeconfigPath();
    }
}
