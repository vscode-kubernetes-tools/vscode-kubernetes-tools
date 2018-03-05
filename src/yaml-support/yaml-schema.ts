import * as _ from 'lodash';
import Uri from 'vscode-uri';
import * as vscode from 'vscode';
import { yamlLocator } from "./yaml-locator";
import {
    VSCODE_YAML_EXTENSION_ID, KUBERNETES_SCHEMA, KUBERNETES_GROUP_VERSION_KIND, GROUP_VERSION_KIND_SEPARATOR,
    KUBERNETES_SCHEMA_FILE
} from "./yaml-constant";
import * as util from "./yaml-util";

// the schema for kubernetes
const _definitions = {};

// load the kubernetes schema and make some modifications to $ref node
export function loadSchema(schemaFile: string) {
    const schemaRaw = util.loadJson(schemaFile);
    const definitions = schemaRaw.definitions;
    const toFixed = [];
    for (const name of Object.keys(definitions)) {
        const currentSchema = definitions[name];
        if (currentSchema[KUBERNETES_GROUP_VERSION_KIND] && currentSchema[KUBERNETES_GROUP_VERSION_KIND].length) {
            // if the schema contains 'x-kubernetes-group-version-kind'. then it is a direct kubernetes manifest,
            // eg: service, pod, deployment
            const groupKindNode = currentSchema[KUBERNETES_GROUP_VERSION_KIND];

            // delete 'x-kubernetes-group-version-kind' since it is not a schema standard, it is only a selector
            delete currentSchema[KUBERNETES_GROUP_VERSION_KIND];

            groupKindNode.forEach((groupKindNodeItem) => {
                const { id, apiVersion, kind } = util.getKubernetesGroupVersionKind(groupKindNodeItem);

                // a direct kubernetes manifest has two reference keys, id && name
                // id: apiVersion + kind
                // name: the name in 'definitions' of schema
                _definitions[id] = _definitions[name.toLowerCase()] = {
                    apiVersion,
                    name,
                    kind,
                    ...currentSchema
                };
            });
        } else {
            // if x-kubernetes-group-version-kind cannot be found, then it is an in-direct schema refereed by
            // direct kubernetes manifest, eg: io.k8s.kubernetes.pkg.api.v1.PodSpec
            _definitions[name.toLowerCase()] = {
                name,
                ...currentSchema
            };
        }

        // fix on each node in properties for $ref since it will directly reference '#/definitions/...'
        // we need to convert it into schema like 'kubernetes://schema/...'
        // we need also an array to collect them since we need to get schema from _definitions, at this point, we have
        // not finished the process of add schemas to _definitions, call patchOnRef will fail for some cases.
        toFixed.push(currentSchema['properties']);
    }

    for (const fix of toFixed ) {
        patchOnRef(fix);
    }
}

export async function registerYamlSchemaSupport() {
    loadSchema(KUBERNETES_SCHEMA_FILE);
    const yamlPlugin: any = await activateYamlExtension();
    if (!yamlPlugin || !yamlPlugin.registerContributor) {
        // activateYamlExtension has already alerted to users for errors.
        return;
    }

    // register for kubernetes schema provider

    // the first api will be called by vscode-yaml extension to decide whether the schema can be handled by this
    // contributor, if it returns undefined, means it doesn't support this yaml file, vscode-yaml will ask other contributors

    // the second api  will give the parameter uri returned by the first api, and ask for the json content(after stringify) of
    // the schema
    yamlPlugin.registerContributor(KUBERNETES_SCHEMA, (resource) => {
        const textEditor = vscode.window.visibleTextEditors.find((editor) => editor.document.uri.toString() === resource);
        if (textEditor) {
            const yamlDocs = yamlLocator.getYamlDocuments(textEditor.document);
            const choices: string[] = [];
            yamlDocs.forEach((doc) => {
                // if the yaml document contains apiVersion and kind node, it will report it is a kubernetes yaml
                // file
                const topLevelMapping = doc.nodes.find((node) => node.kind === 'MAPPING');

                const apiVersion = util.getPropertyValue(topLevelMapping, 'apiVersion');
                const kind = util.getPropertyValue(topLevelMapping, 'kind');
                if (apiVersion && kind) {
                    choices.push(apiVersion.value.raw + GROUP_VERSION_KIND_SEPARATOR + kind.value.raw);
                }
            });
            return util.makeKubernetesUri(choices);
        }
    }, (uri) => {
        const _uri = Uri.parse(uri);
        if (_uri.scheme !== KUBERNETES_SCHEMA) {
            return undefined;
        }
        if (!_uri.path || !_uri.path.startsWith('/')) {
            return undefined;
        }

        // slice(1) to remove the first '/' in schema
        // eg: kubernetes://schema/io.k8s.kubernetes.pkg.apis.extensions.v1beta1.httpingresspath will have
        // path '/io.k8s.kubernetes.pkg.apis.extensions.v1beta1.httpingresspath'
        const manifestType = _uri.path.slice(1);

        // if it is a multiple choice, make an 'oneof' schema.
        if (manifestType.includes('+')) {
            const manifestRefList = manifestType.split('+').map(util.makeRefOnKubernetes);
            return JSON.stringify({ oneOf: manifestRefList });
        }
        if (_definitions[manifestType]) {
            return JSON.stringify(_definitions[manifestType]);
        }

        // if we cannot find any schema in _definitions for manifestType, we will iterate the values in  _definitions to
        // find the schema with the apiVersion and kind
        //apiVersionKind[0] is apiVersion and apiVersionKind[1] is kind
        const apiVersionKind = manifestType.split(GROUP_VERSION_KIND_SEPARATOR);
        const apiVersion = apiVersionKind[0];
        const kind = apiVersionKind[1];
        const matchedSchema = _.values(_definitions).find((schema) =>
            util.equalIgnoreCase(apiVersion, schema.apiVersion) &&
            util.equalIgnoreCase(kind, schema.kind));
        if (matchedSchema) {
            return JSON.stringify(matchedSchema);
        }
        return undefined;
    });
}

// convert '#/definitions/com.github.openshift.origin.pkg.build.apis.build.v1.ImageLabel' to
// convert $ref = '#/definitions/io.k8s.kubernetes.pkg.apis.extensions.v1beta1.HTTPIngressPath' to
//'$ref': 'kubernetes://schema/io.k8s.kubernetes.pkg.apis.extensions.v1beta1.httpingresspath'

// 'com.github.openshift.origin.pkg.build.apis.build.v1.ImageLabel'
function getNameInDefinitions ($ref: string): string {
    const prefix = '#/definitions/';
    if ($ref.startsWith(prefix)) {
        return $ref.slice(prefix.length);
    } else {
        return prefix;
    }
}

// patch on schema $ref with values like 'kubernetes://schema/...'
function patchOnRef(node) {
    if (!node) {
        return;
    }
    if (_.isArray(node)) {
        for (const subItem of node) {
            patchOnRef(subItem);
        }
    }
    if (!_.isObject(node)) {
        return;
    }
    for (const key of Object.keys(node)) {
        patchOnRef(node[key]);
    }

    if (node.$ref) {
        const referId = getNameInDefinitions(node.$ref.toLowerCase());
        const match = _definitions[referId];
        if (match) {
            // replacing $ref
            node.$ref = util.makeKubernetesUri(match.name);
        }
    }
}

// find redhat.vscode-yaml extension and try to activate it
async function activateYamlExtension() {
    const ext: vscode.Extension<any> = vscode.extensions.getExtension(VSCODE_YAML_EXTENSION_ID);
    if (!ext) {
        vscode.window.showWarningMessage('Please install the "YAML Support by Red Hat" extension in marketplace.');
        return;
    }
    const yamlPlugin = await ext.activate();

    if (!yamlPlugin || !yamlPlugin.registerContributor) {
        vscode.window.showWarningMessage('Please install the latest "YAML Support by Red Hat" extension in marketplace.');
        return;
    }

    return yamlPlugin;
}
