'use strict';

/**
 * An utility function for splitting text into lines.
 */
export function splitLines(text) {
    return text.split(/\r\n?|\n/);
} 

/**
 * A very easy utility function for decides whether the text is support to be a kubernetes yaml file, further
 * implementations is needed to be more precise on the result rather than the regex test.
 */
export function isKubernetesYamlFile(text) {
    return !!(/^kind\s*\:/g.exec(text) ||
        /[^a-zA-Z]kind\s*\:/g.exec(text) ||
        /^apiVersion\s*\:/g.exec(text) ||
        /[^a-zA-Z]apiVersion\s*\:/g.exec(text)
    );
}

/**
 * An utility function for get apiVersion and kind from 'x-kubernetes-group-version-kind' node in kubernetes schema.
 */
export function parseApiVersionKind(groupKindNode) {
    if (!groupKindNode.version) {
        throw new Error("Invalid 'x-kubernetes-group-version-kind' node, 'version' is missing.");
    }

    if (!groupKindNode.kind) {
        throw new Error("Invalid 'x-kubernetes-group-version-kind' node, 'kind' is missing.");
    }
    return {
        apiVersion: (groupKindNode.group ? groupKindNode.group + '/' : '') + groupKindNode.version, 
        kind: groupKindNode.kind
    };
}
