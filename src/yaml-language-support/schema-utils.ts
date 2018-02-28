'use strict';

import { KubernetesGroupKindNode, KubernetesResourceObjectBase } from "./schema-models";

/**
 * An utility function for splitting text into lines.
 */
export function splitLines(text: string): string[] {
    return text.split(/\r\n?|\n/);
} 

/**
 * A very easy utility function for decides whether the text is support to be a kubernetes yaml file, further
 * implementations is needed to be more precise on the result rather than the regex test.
 */
export function isKubernetesYamlFile(text: string): boolean {
    return !!(/\bkind\s*:/g.exec(text) ||
        /\bapiVersion\s*:/g.exec(text));
}

/**
 * An utility function for get apiVersion and kind from 'x-kubernetes-group-version-kind' node in kubernetes schema.
 */
export function parseApiVersionKind(groupKindNode: KubernetesGroupKindNode): KubernetesResourceObjectBase {
    if (!groupKindNode.version) {
        throw new Error("Encounter invalid kubernetes schema with no 'version' information.");
    }

    if (!groupKindNode.kind) {
        throw new Error("Encounter invalid kubernetes schema with no 'kind' information");
    }

    // apiVersion := [%group%/] ? %version% 
    // eg:  {"group": "apps", "kind": "Deployment","version": "v1beta1" } will map to:
    // apiVersion: extensions/v1beta1, kind: Deployment

    return {
        apiVersion: (groupKindNode.group ? groupKindNode.group + '/' : '') + groupKindNode.version, 
        kind: groupKindNode.kind
    };
}
