import * as api from '../api/api';
import * as v1 from '../api/v1';
import * as v1adapter from './v1.adapter';

export function apiBroker(): api.APIBroker {
    return new APIBroker();
}

class APIBroker implements api.APIBroker {
    api(version: string): api.APIVersion {
        switch (version) {
            case "0.1":
            case "0.2":
                return {
                    succeeded: false,
                    reason: 'APIVersionNoLongerSupported',
                };
            case v1.id:
                return {
                    succeeded: true,
                    api: v1adapter.implementation()
                };
            default:
                return {
                    succeeded: false,
                    reason: 'APIVersionUnknownInThisExtensionVersion',
                };
        }
    }
}
