import { get as getClusterProviderRegistry } from '../../../components/clusterprovider/clusterproviderregistry';
import * as v1 from '../../api/clusterprovider/v1';

export function implementation(): v1.API {
    return impl;
}

class Impl implements v1.API {
    clusterProviderRegistry(): v1.ClusterProviderRegistry {
        return getClusterProviderRegistry();
    }
}

const impl = new Impl();
