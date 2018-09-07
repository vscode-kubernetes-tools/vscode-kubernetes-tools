export interface APIBroker {
    api(requested: APIRequest): APIVersion;
}

export interface APIRequest {
    component: string;
    version: string;
}

export interface AvailableAPIVersion {
    readonly succeeded: true;
    readonly api: any;
}

// We prefer this to an enum because there is less chance of a new
// entry accidentally changing the values.
export type UnavailableAPIVersionReason =
    'APIVersionNoLongerSupported' |
    'APIVersionUnknownInThisExtensionVersion' |
    'APIComponentUnknownInThisExtensionVersion';

export interface UnavailableAPIVersion {
    readonly succeeded: false;
    readonly reason: UnavailableAPIVersionReason;
}

export type APIVersion = AvailableAPIVersion | UnavailableAPIVersion;
