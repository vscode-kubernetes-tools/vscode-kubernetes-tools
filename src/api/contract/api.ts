import { ExtensionAPI } from "../../extension.api";

// The contents of this file are the core API contract used to discover actual
// component APIs.  We can add new component APIs, or change the way APIBroker
// works, but we *must* keep the APIBroker signature compatible.  Basically
// DON'T CHANGE ANYTHING IN THIS FILE unless you know how it's going to affect
// API clients at the discovery level.

export type APIUnavailableReason =
    'version-unknown'    // installed k8s extension is so old it doesn't support the requested API version
    | 'version-removed';  // requested API version is so old that the installed k8s extension no longer supports it
    // (Note we never return an 'extension not present' value because, well, if we are returning
    // something then the extension must be present!  Such a value can be helpful when writing consumer
    // libraries though.)

export interface APIUnavailable {
    readonly available: false;
    readonly reason: APIUnavailableReason;
}

export interface APIAvailable<T> {
    readonly available: true;
    readonly api: T;
}

export type API<T> = APIAvailable<T> | APIUnavailable;

// The extension activate method must return one of these
export interface APIBroker extends ExtensionAPI /* for backward compatibility */ {
    get(component: string, version: string): API<any>;
}
