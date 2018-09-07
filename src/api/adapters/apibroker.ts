import * as api from '../api/api';
import * as clusterprovider from '../api/clusterprovider/component';
import * as clusterproviderapibroker from './clusterprovider/apibroker';

export function apiBroker(): api.APIBroker {
    return new APIBroker();
}

class APIBroker implements api.APIBroker {
    api(requested: api.APIRequest): api.APIVersion {
        switch (requested.component) {
            case clusterprovider.componentId:
                return clusterproviderapibroker.api(requested.version);
            default:
                return {
                    succeeded: false,
                    reason: 'APIComponentUnknownInThisExtensionVersion',
                };
        }
        // switch (version) {
        //     case "0.1":
        //     case "0.2":
        //         return {
        //             succeeded: false,
        //             reason: 'APIVersionNoLongerSupported',
        //         };
        //     case v1.id:
        //         return {
        //             succeeded: true,
        //             api: v1adapter.implementation()
        //         };
        //     default:
        //         return {
        //             succeeded: false,
        //             reason: 'APIVersionUnknownInThisExtensionVersion',
        //         };
        // }
    }
}
