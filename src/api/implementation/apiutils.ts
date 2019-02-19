import { API } from "../contract/api";

export function available<T>(api: T): API<T> {
    return { available: true, api: api };
}

export const versionUnknown: API<any> = { available: false, reason: "version-unknown" };
export const versionRemoved: API<any> = { available: false, reason: "version-removed" };
