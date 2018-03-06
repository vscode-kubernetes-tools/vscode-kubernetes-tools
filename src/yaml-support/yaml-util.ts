import * as fs from 'fs';
import * as _ from 'lodash';
import * as vscode from 'vscode';

import { yamlLocator, YamlMap, YamlNode } from './yaml-locator';
import { util as yamlUtil } from 'node-yaml-parser';
import { GROUP_VERSION_KIND_SEPARATOR, KUBERNETES_SCHEMA_PREFIX } from "./yaml-constant";

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
 * @returns {any} the parsed data if no error occurs, otherwise undefined is returned
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
    if (_.isString(ids)) {
        return makeKubernetesUri([<string>ids]);
    }
    const newIds = _.uniq(ids);
    if (newIds.length === 1) {
        return KUBERNETES_SCHEMA_PREFIX + newIds[0].toLowerCase();
    } else if (ids.length > 1) {
        return KUBERNETES_SCHEMA_PREFIX + newIds.map((id) => id.toLowerCase()).join('+');
    } else {
        return undefined;
    }
}

// create a $ref schema for kubernetes manifest
export function makeRefOnKubernetes(id: string) {
    return { $ref: makeKubernetesUri(id) };
}


// extract id, apiVersion, kind from x-kubernetes-group-version-kind node in schema
export function getKubernetesGroupVersionKind(groupKindNodeItem) {
    const group = getValue(groupKindNodeItem, 'group', true);
    const version = getValue(groupKindNodeItem, 'version', true);
    const apiVersion = group ? group + '/' + version: version;
    const kind = getValue(groupKindNodeItem, 'kind', true);
    return { id: apiVersion + GROUP_VERSION_KIND_SEPARATOR + kind, apiVersion, kind };
}


// test whether two strings are equal ignore case
export function equalIgnoreCase(a: string, b: string) {
    return a && b && typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
}

// Get the string value of key in a yaml mapping node(parsed by node-yaml-parser)
// eg: on the following yaml, this method will return 'value1' for key 'key1'
//
//      key1: value1
//      key2: value2
//
export function getPropertyValue(mapNode: YamlMap, key: string, ignoreCase: boolean = false) {
    // TODO, unwrap quotes
    return mapNode.mappings.find((mapping) => mapping.key &&
        (ignoreCase ? key === mapping.key.raw : equalIgnoreCase(key, mapping.key.raw)));
}

// get the value in a javascript object with key(may be case sensitive due to the third parameter)
function getValue(node, key: string, ignoreCase: boolean = false) {
    if (!node) {
        return undefined;
    }
    if (node.hasOwnProperty(key)) {
        return node[key];
    }
    if (ignoreCase) {
        for (const _key of Object.keys(node)) {
            if (equalIgnoreCase(key, _key)) {
                return node[_key];
            }
        }
    }
}