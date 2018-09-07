/// <reference path='../../api/vscode-kubernetes-tools-api.d.ts' />

import { APIVersion } from 'vscode-kubernetes-tools-api';
import * as v1 from 'vscode-kubernetes-tools-api.clusterprovider.v1';
import * as v1adapter from './v1.adapter';

export function api(version: string): APIVersion {
    switch (version) {
        case "0.1":
        case "0.2":
            return {
                succeeded: false,
                reason: 'APIVersionNoLongerSupported',
            };
        case v1.versionId:
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
