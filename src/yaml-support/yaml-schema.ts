import * as _ from 'lodash';
import Uri from 'vscode-uri';
import * as vscode from 'vscode';
import { yamlLocator } from "./yaml-locator";
import { VSCODE_YAML, KUBERNETES_SCHEMA, KUBERNETES_GROUP_VERSION_KIND, GROUP_VERSION_KIND_SEPARATOR } from "./yaml-constant";

// the schema for kubernetes
const _definitions = {};

// load the kubernetes schema and make some modifications to $ref node
export function loadSchema(schemaFile: string) {
    const schemaRaw = require(schemaFile);
    const definitions = schemaRaw.definitions;
    const toFixed = [];
    for (let key of Object.keys(definitions)) {
        let node = definitions[key];
        const name = key;
        if (node[KUBERNETES_GROUP_VERSION_KIND]) {
            let groupKindNode = node[KUBERNETES_GROUP_VERSION_KIND];
            delete node[KUBERNETES_GROUP_VERSION_KIND];
            if (groupKindNode.length) {
                groupKindNode.forEach((groupKindNodeItem) => {
                    const apiVersion = ((groupKindNodeItem.Group ? groupKindNodeItem.Group + '/' : '') + groupKindNodeItem.Version);
                    const kind = groupKindNodeItem.Kind;
                    _definitions[apiVersion + GROUP_VERSION_KIND_SEPARATOR + kind] = _definitions[name.toLowerCase()] = {
                        apiVersion,
                        name,
                        kind,
                        ...node
                    };


                });
            }
        } else {
            _definitions[name.toLowerCase()] = {
                name,
                ...node
            };
        }

        toFixed.push(node['properties']);
    }

    for (let fix of toFixed ) {
        patchOnRef(fix);
    }
}

export async function registerYamlSchemaSupport() {
    loadSchema(KUBERNETES_SCHEMA);
    let yamlPlugin;
    const installedExtensions: any[] = vscode.extensions.all;
    for (let ext of installedExtensions) {
        if (ext.id === VSCODE_YAML) {
            try {
                yamlPlugin = await Promise.resolve(ext.activate());
                break;
            } catch (error) {
                console.log('Failed to activate the Yaml Extension: ' + error);
            }
            break;
        }
    }
    if (!yamlPlugin) {
        console.log('vscode-yaml plugin doesn\'t expose the entry to register custom schema provider.');
        return;
    }
    // register for kubernetes schema provider
    yamlPlugin.registerContributor('kubernetes', (resource) => {
        const textEditor = vscode.window.visibleTextEditors.find((editor) => editor.document.uri.toString() === resource);
        if (textEditor) {
            const yamlDocs = yamlLocator.getYamlDocuments(textEditor.document);
            let choices: string[] = [];
            yamlDocs.forEach((doc)=> {
                // if the yaml document contains apiVersion and kind node, it will report it is a kubernetes yaml
                // file
                const rootMapping = doc.nodes.find((node) => node.kind === 'MAPPING');
                // TODO, unwrap quotes
                const apiVersion = rootMapping.mappings.find((map) => map.key && map.key.raw === 'apiVersion');
                const kind = rootMapping.mappings.find((map) => map.key && map.key.raw === 'kind');
                if (apiVersion && kind) {
                    choices.push(apiVersion.value.raw + GROUP_VERSION_KIND_SEPARATOR + kind.value.raw);
                }
            });
            choices = _.uniq(choices);
            if (choices.length > 1) {
                return 'kubernetes://combine/' + _.uniq(choices).join('+');
            }
            if (choices.length === 1) {
                return 'kubernetes://manifest/'  + choices[0];
            }
            return undefined;
        }
    }, (uri) => {
        let _uri = Uri.parse(uri);
        if (!_uri.path || ! _uri.path.startsWith('/')) {
            return '';
        }
        if (_uri.path.includes('+')) {
            const manifestRef = _uri.path.slice(1).split('+').map((r) => {
                return {$ref: `kubernetes://manifest/${r}`};
            });
            return jsonToString({ oneOf: [...manifestRef] });
        }
        let manifestType = _uri.path.slice(1);
        //apiVersionKind[0] is apiVersion and apiVersionKind[1] is kind
        const apiVersionKind = manifestType.split(GROUP_VERSION_KIND_SEPARATOR);
        if (_definitions[manifestType]) {
            return jsonToString(_definitions[manifestType]);
        }
        const matchedSchema = _.values(_definitions).find((schema) => schema.apiVersion && schema.kind && apiVersionKind[1] === schema.kind &&
                apiVersionKind[0] === schema.apiVersion);
        if (matchedSchema) {
            return jsonToString(matchedSchema);
        }
        return undefined;
    });
}

// convert '#/definitions/com.github.openshift.origin.pkg.build.apis.build.v1.ImageLabel' to
// 'com.github.openshift.origin.pkg.build.apis.build.v1.ImageLabel'
const getNameInDefinitions = ($ref: string): string => {
    const prefix = '#/definitions/';
    if ($ref.includes(prefix)) {
        return $ref.slice($ref.indexOf(prefix) + prefix.length);
    } else {
        throw new Error('bad reference name.');
    }
};

// convert $ref = '#/definitions/io.k8s.kubernetes.pkg.apis.extensions.v1beta1.HTTPIngressPath' to
//'$ref': 'kubernetes://manifest/io.k8s.kubernetes.pkg.apis.extensions.v1beta1.httpingresspath'
function patchOnRef(node) {
    if (!node) {
        return;
    }
    if (_.isArray(node)) {
        for (let subItem of node) {
            patchOnRef(subItem);
        }
    }
    if (!_.isObject(node)) {
        return;
    }
    for(let key of Object.keys(node)) {
        patchOnRef(node[key]);
    }

    const value = node;
    if (value && value.$ref) {
        const match = _definitions[getNameInDefinitions(value.$ref.toLowerCase())];
        if (match) {
            value.$ref = `kubernetes://manifest/${match.name.toLowerCase()}`;
        } else {
            throw new Error(`Unsupported $ref value ${value.$ref}.`);
        }
    }
}

// convert a json object to string
function jsonToString(json: any): string {
    return JSON.stringify(json);
}

