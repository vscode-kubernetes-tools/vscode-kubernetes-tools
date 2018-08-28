import * as _ from 'lodash';
import * as semver from 'semver';
import Uri from 'vscode-uri';
import * as vscode from 'vscode';
import { yamlLocator, YamlMap } from "./yaml-locator";
import {
    VSCODE_YAML_EXTENSION_ID, KUBERNETES_SCHEMA, KUBERNETES_GROUP_VERSION_KIND, GROUP_VERSION_KIND_SEPARATOR,
    KUBERNETES_SCHEMA_FILE, KUBERNETES_SCHEMA_ENUM_FILE
} from "./yaml-constant";
import * as util from "./yaml-util";
import { formatComplex, formatOne, formatType } from '../schema-formatting';

export interface KubernetesSchema {
    readonly name: string;
    readonly description?: string;
    readonly id?: string;
    readonly apiVersion?: string;
    readonly kind?: string;
    readonly 'x-kubernetes-group-version-kind'?: any[];
    readonly properties?: { [key: string]: any; };
}

// The function signature exposed by vscode-yaml:
// 1. the requestSchema api will be called by vscode-yaml extension to decide whether the schema can be handled by this
// contributor, if it returns undefined, means it doesn't support this yaml file, vscode-yaml will ask other contributors
// 2. the requestSchemaContent api  will give the parameter uri returned by the first api, and ask for the json content(after stringify) of
// the schema
declare type YamlSchemaContributor = (schema: string,
                                       requestSchema: (resource: string) => string,
                                       requestSchemaContent: (uri: string) => string) => void;

class KubernetesSchemaHolder {
    // the schema for kubernetes
    private definitions: { [key: string]: KubernetesSchema; } = {};

    private schemaEnums: { [key: string]: { [key: string]: [string[]] }; };

    // load the kubernetes schema and make some modifications to $ref node
    public loadSchema(schemaFile: string, schemaEnumFile?: string): void {
        const schemaRaw = util.loadJson(schemaFile);
        this.schemaEnums = schemaEnumFile ? util.loadJson(schemaEnumFile) : {};
        const definitions = schemaRaw.definitions;
        for (const name of Object.keys(definitions)) {
            this.saveSchemaWithManifestStyleKeys(name, definitions[name]);
        }

        for (const schema of _.values(this.definitions) ) {
            if (schema.properties) {
                // the swagger schema has very short description on properties, we need to get the actual type of
                // the property and provide more description/properties details, just like `kubernetes explain` do.
                _.each(schema.properties, (propVal, propKey) => {
                    if (schema.kind && propKey === 'kind') {
                        propVal.markdownDescription = this.getMarkdownDescription(schema.kind, undefined, schema, true);
                        return;
                    }

                    const currentPropertyTypeRef = propVal.$ref || (propVal.items ? propVal.items.$ref : undefined);
                    if (_.isString(currentPropertyTypeRef)) {
                        const id = getNameInDefinitions(currentPropertyTypeRef);
                        const propSchema = this.lookup(id);
                        if (propSchema) {
                            propVal.markdownDescription = this.getMarkdownDescription(propKey, propVal, propSchema);
                        }
                    } else {
                        propVal.markdownDescription = this.getMarkdownDescription(propKey, propVal, undefined);
                    }
                });

                // fix on each node in properties for $ref since it will directly reference '#/definitions/...'
                // we need to convert it into schema like 'kubernetes://schema/...'
                // we need also an array to collect them since we need to get schema from _definitions, at this point, we have
                // not finished the process of add schemas to _definitions, call patchOnRef will fail for some cases.
                this.replaceDefinitionRefsWithYamlSchemaUris(schema.properties);
                this.loadEnumsForKubernetesSchema(schema);
            }
        }
    }

    // get kubernetes schema by the key
    public lookup(key: string): KubernetesSchema {
        return key ? this.definitions[key.toLowerCase()] : undefined;
    }

    /**
     * Save the schema object in swagger json to schema map.
     *
     * @param {string} name the property name in definition node of swagger json
     * @param originalSchema the origin schema object in swagger json
     */
    private saveSchemaWithManifestStyleKeys(name: string, originalSchema: any): void {
        if (isGroupVersionKindStyle(originalSchema)) {
            // if the schema contains 'x-kubernetes-group-version-kind'. then it is a direct kubernetes manifest,
            getManifestStyleSchemas(originalSchema).forEach((schema: KubernetesSchema) =>  {
                this.saveSchema({
                    name,
                    ...schema
                });
            });

        } else {
            // if x-kubernetes-group-version-kind cannot be found, then it is an in-direct schema refereed by
            // direct kubernetes manifest, eg: io.k8s.kubernetes.pkg.api.v1.PodSpec
            this.saveSchema({
                name,
                ...originalSchema
            });
        }
    }

    // replace schema $ref with values like 'kubernetes://schema/...'
    private replaceDefinitionRefsWithYamlSchemaUris(node: any): void {
        if (!node) {
            return;
        }
        if (_.isArray(node)) {
            for (const subItem of <any[]>node) {
                this.replaceDefinitionRefsWithYamlSchemaUris(subItem);
            }
        }
        if (!_.isObject(node)) {
            return;
        }
        for (const key of Object.keys(node)) {
            this.replaceDefinitionRefsWithYamlSchemaUris(node[key]);
        }

        if (_.isString(node.$ref)) {
            const name = getNameInDefinitions(node.$ref);
            const schema = this.lookup(name);
            if (schema) {
                // replacing $ref
                node.$ref = util.makeKubernetesUri(schema.name);
            }
        }
    }

    // add enum field for pre-defined enums in schema-enums json file
    private loadEnumsForKubernetesSchema(node: KubernetesSchema) {
        if (node.properties && this.schemaEnums[node.name]) {
            _.each(node.properties, (propSchema, propKey) => {
                if (this.schemaEnums[node.name][propKey]) {
                    propSchema.enum = this.schemaEnums[node.name][propKey];
                }
            });
        }
    }

    // save the schema to the _definitions
    private saveSchema(schema: KubernetesSchema): void {
        if (schema.name) {
            this.definitions[schema.name.toLowerCase()] = schema;
        }
        if (schema.id) {
            this.definitions[schema.id.toLowerCase()] = schema;
        }
    }

    // get the markdown format of document for the current property and the type of current property
    private getMarkdownDescription(currentPropertyName: string, currentProperty: any, targetSchema: any, isKind = false): string {
        if (isKind) {
            return formatComplex(currentPropertyName, targetSchema.description, undefined, targetSchema.properties);
        }
        if (!targetSchema) {
            return formatOne(currentPropertyName, formatType(currentProperty), currentProperty.description);
        }
        const properties = targetSchema.properties;
        if (properties) {
            return formatComplex(currentPropertyName, currentProperty ? currentProperty.description : "",
                targetSchema.description, properties);
        }
        return currentProperty ? currentProperty.description : (targetSchema ? targetSchema.description : "");
    }
}

const kubeSchema: KubernetesSchemaHolder = new KubernetesSchemaHolder();

export async function registerYamlSchemaSupport(): Promise<void> {
    kubeSchema.loadSchema(KUBERNETES_SCHEMA_FILE, KUBERNETES_SCHEMA_ENUM_FILE);
    const yamlPlugin: any = await activateYamlExtension();
    if (!yamlPlugin || !yamlPlugin.registerContributor) {
        // activateYamlExtension has already alerted to users for errors.
        return;
    }
    // register for kubernetes schema provider
    yamlPlugin.registerContributor(KUBERNETES_SCHEMA, requestYamlSchemaUriCallback,  requestYamlSchemaContentCallback);
}

// see docs from YamlSchemaContributor
function requestYamlSchemaUriCallback(resource: string): string {
    const textEditor = vscode.window.visibleTextEditors.find((editor) => editor.document.uri.toString() === resource);
    if (textEditor) {
        const yamlDocs = yamlLocator.getYamlDocuments(textEditor.document);
        const choices: string[] = [];
        yamlDocs.forEach((doc) => {
            // if the yaml document contains apiVersion and kind node, it will report it is a kubernetes yaml
            // file
            const topLevelMapping = <YamlMap>doc.nodes.find((node) => node.kind === 'MAPPING');
            if (topLevelMapping) {
                // if the overall yaml is an map, find the apiVersion and kind properties in yaml
                const apiVersion = util.getYamlMappingValue(topLevelMapping, 'apiVersion');
                const kind = util.getYamlMappingValue(topLevelMapping, 'kind');
                if (apiVersion && kind) {
                    choices.push(apiVersion + GROUP_VERSION_KIND_SEPARATOR + kind);
                }
            }
        });
        return util.makeKubernetesUri(choices);
    }
}

// see docs from YamlSchemaContributor
function requestYamlSchemaContentCallback(uri: string): string {
    const parsedUri = Uri.parse(uri);
    if (parsedUri.scheme !== KUBERNETES_SCHEMA) {
        return undefined;
    }
    if (!parsedUri.path || !parsedUri.path.startsWith('/')) {
        return undefined;
    }

    // slice(1) to remove the first '/' in schema
    // eg: kubernetes://schema/io.k8s.kubernetes.pkg.apis.extensions.v1beta1.httpingresspath will have
    // path '/io.k8s.kubernetes.pkg.apis.extensions.v1beta1.httpingresspath'
    const manifestType = parsedUri.path.slice(1);
    // if it is a multiple choice, make an 'oneof' schema.
    if (manifestType.includes('+')) {
        const manifestRefList = manifestType.split('+').map(util.makeRefOnKubernetes);
        // yaml language server supports schemaSequence at
        // https://github.com/redhat-developer/yaml-language-server/pull/81
        return JSON.stringify({ schemaSequence: manifestRefList });
    }
    const schema = kubeSchema.lookup(manifestType);

    // convert it to string since vscode-yaml need the string format
    if (schema) {
        return JSON.stringify(schema);
    }
    return undefined;

}

/**
 * Tell whether or not the swagger schema is a kubernetes manifest schema, a kubernetes manifest schema like Service
 * should have `x-kubernetes-group-version-kind` node.
 *
 * @param originalSchema the origin schema object in swagger json
 * @return whether or not the swagger schema is
 */
function isGroupVersionKindStyle(originalSchema: any): boolean {
    return originalSchema[KUBERNETES_GROUP_VERSION_KIND] && originalSchema[KUBERNETES_GROUP_VERSION_KIND].length;
}

/**
 * Process on kubernetes manifest schemas, for each selector in x-kubernetes-group-version-kind,
 * extract apiVersion and kind and make a id composed by apiVersion and kind.
 *
 * @param originalSchema the origin schema object in swagger json
 * @returns {KubernetesSchema[]} an array of schemas for the same manifest differentiated by id/apiVersion/kind;
 */
function getManifestStyleSchemas(originalSchema: any): KubernetesSchema[] {
    const schemas = [];
    // eg: service, pod, deployment
    const groupKindNode = originalSchema[KUBERNETES_GROUP_VERSION_KIND];

    // delete 'x-kubernetes-group-version-kind' since it is not a schema standard, it is only a selector
    delete originalSchema[KUBERNETES_GROUP_VERSION_KIND];

    groupKindNode.forEach((groupKindNode) => {
        const { id, apiVersion, kind } = util.parseKubernetesGroupVersionKind(groupKindNode);

        // a direct kubernetes manifest has two reference keys: id && name
        // id: apiVersion + kind
        // name: the name in 'definitions' of schema
        schemas.push({
            id,
            apiVersion,
            kind,
            ...originalSchema
        });
    });
    return schemas;
}

// convert '#/definitions/com.github.openshift.origin.pkg.build.apis.build.v1.ImageLabel' to
// 'com.github.openshift.origin.pkg.build.apis.build.v1.ImageLabel'
function getNameInDefinitions ($ref: string): string {
    const prefix = '#/definitions/';
    if ($ref.startsWith(prefix)) {
        return $ref.slice(prefix.length);
    } else {
        return prefix;
    }
}

// find redhat.vscode-yaml extension and try to activate it to get the yaml contributor
async function activateYamlExtension(): Promise<{registerContributor: YamlSchemaContributor}> {
    const ext: vscode.Extension<any> = vscode.extensions.getExtension(VSCODE_YAML_EXTENSION_ID);
    if (!ext) {
        vscode.window.showWarningMessage('Please install \'YAML Support by Red Hat\' via the Extensions pane.');
        return;
    }
    const yamlPlugin = await ext.activate();

    if (!yamlPlugin || !yamlPlugin.registerContributor) {
        vscode.window.showWarningMessage('The installed Red Hat YAML extension doesn\'t support Kubernetes Intellisense. Please upgrade \'YAML Support by Red Hat\' via the Extensions pane.');
        return;
    }

    if (ext.packageJSON.version && !semver.satisfies(ext.packageJSON.version, '^0.0.15')) {
        vscode.window.showWarningMessage('The installed Red Hat YAML extension doesn\'t support multiple schemas. Please upgrade \'YAML Support by Red Hat\' via the Extensions pane.');
    }
    return yamlPlugin;
}
