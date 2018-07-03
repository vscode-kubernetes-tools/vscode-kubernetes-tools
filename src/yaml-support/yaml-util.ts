import * as fs from 'fs';
import * as _ from 'lodash';
import * as vscode from 'vscode';

import { yamlLocator, YamlMap } from './yaml-locator';
import { util as yamlUtil } from 'node-yaml-parser';
import { GROUP_VERSION_KIND_SEPARATOR, KUBERNETES_SCHEMA_PREFIX } from "./yaml-constant";

export enum StringComparison {
    Ordinal,
    OrdinalIgnoreCase
}

/**
 * Test whether the current position is at any key in yaml file.
 *
 * @param {vscode.TextDocument} doc the yaml text document
 * @param {vscode.Position} pos the position
 * @returns {boolean} whether the current position is at any key
 */
export function isPositionInKey(doc: vscode.TextDocument, pos: vscode.Position): boolean {
    if (!doc || !pos) {
        return false;
    }

    const { matchedNode } = yamlLocator.getMatchedElement(doc, pos);
    return yamlUtil.isKey(matchedNode);
}

/**
 * Load json data from a json file.
 * @param {string} file
 * @returns the parsed data if no error occurs, otherwise undefined is returned
 */
export function loadJson(file: string): any {
    if (fs.existsSync(file)) {
        try {
            return JSON.parse(fs.readFileSync(file, 'utf-8'));
        } catch (err) {
            // ignore
        }
    }
    return undefined;
}

/**
 * Construct a kubernetes uri for kubernetes manifest, if there are multiple type of manifest, combine them
 * using a '+' character, duplicate ids is allowed and will be removed.
 *
 * @param {string[]} ids the id array of the manifest,
 *                  eg: ['io.k8s.kubernetes.pkg.apis.extensions.v1beta1.HTTPIngressPath']
 * @returns {string} the schema uri,
 *                  eg:  kubernetes://schema/io.k8s.kubernetes.pkg.apis.extensions.v1beta1.
 *  httpingresspath, the uri is converted to low case.
 */
export function makeKubernetesUri(ids: string | string[]): string {
    if (!ids) {
        throw new Error("'id' is required for constructing a schema uri.");
    }

    if (_.isString(ids)) {
        return KUBERNETES_SCHEMA_PREFIX + (<string>ids).toLowerCase();
    }
    const newIds = _.uniq(ids);
    if (newIds.length === 1) {
        return makeKubernetesUri(newIds[0]);
    } else if (ids.length > 1) {
        return KUBERNETES_SCHEMA_PREFIX + newIds.map((id) => id.toLowerCase()).join('+');
    } else {
        return undefined;
    }
}

// create a $ref schema for kubernetes manifest
export function makeRefOnKubernetes(id: string): { $ref: string } {
    return { $ref: makeKubernetesUri(id) };
}

// extract id, apiVersion, kind from x-kubernetes-group-version-kind node in schema
export function parseKubernetesGroupVersionKind(groupKindNodeItem: any): {id: string, apiVersion: string, kind: string} {
    const group = getStringValue(groupKindNodeItem, 'group', StringComparison.OrdinalIgnoreCase);
    const version = getStringValue(groupKindNodeItem, 'version', StringComparison.OrdinalIgnoreCase);
    const apiVersion = group ? `${group}/${version}`: version;
    const kind = getStringValue(groupKindNodeItem, 'kind', StringComparison.OrdinalIgnoreCase);
    return { id: apiVersion + GROUP_VERSION_KIND_SEPARATOR + kind, apiVersion, kind };
}

// test whether two strings are equal ignore case
export function equalIgnoreCase(a: string, b: string): boolean {
    return _.isString(a) && _.isString(b) && a.toLowerCase() === b.toLowerCase();
}

// Get the string value of key in a yaml mapping node(parsed by node-yaml-parser)
// eg: on the following yaml, this method will return 'value1' for key 'key1'
//
//      key1: value1
//      key2: value2
//
export function getYamlMappingValue(mapRootNode: YamlMap, key: string,
                                    ignoreCase: StringComparison = StringComparison.Ordinal): string {
    // TODO, unwrap quotes
    if (!key) {
        return undefined;
    }
    const keyValueItem = mapRootNode.mappings.find((mapping) => mapping.key &&
        (ignoreCase === StringComparison.OrdinalIgnoreCase ? key === mapping.key.raw : equalIgnoreCase(key, mapping.key.raw)));
    return keyValueItem ? keyValueItem.value.raw : undefined;
}

// get the string value in a javascript object with key(may be case sensitive due to the third parameter)
function getStringValue(node, key: string, ignoreCase: StringComparison = StringComparison.Ordinal): string {
    if (!node) {
        return undefined;
    }
    if (node.hasOwnProperty(key)) {
        return <string>node[key];
    }
    if (ignoreCase === StringComparison.OrdinalIgnoreCase) {
        for (const nodeKey of Object.keys(node)) {
            if (equalIgnoreCase(key, nodeKey)) {
                return <string>node[nodeKey];
            }
        }
    }
}