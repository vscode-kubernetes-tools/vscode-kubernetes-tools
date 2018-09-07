/// <reference path='../vscode-kubernetes-tools-api.d.ts' />

import * as api from 'api';
import * as clusterprovider from 'api.clusterprovider';
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
    }
}
