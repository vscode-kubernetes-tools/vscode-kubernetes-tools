import * as _ from 'lodash';

import { Kubectl } from "../kubectl";
import * as kubectlUtils from '../kubectlUtils';
import { KUBERNETES_SCHEMA_ENUM_FILE, FALLBACK_SCHEMA_FILE, KUBERNETES_GROUP_VERSION_KIND } from "./yaml-constant";
import { formatComplex, formatOne, formatType } from '../schema-formatting';
import * as swagger from '../components/swagger/swagger';
import { failed, succeeded } from '../errorable';
import * as vscode from "vscode";
import * as util from "./yaml-util";
import { getCRDCodeCompletionState, setCRDCodeCompletion } from '../components/config/config';

interface KubernetesSchema {
    readonly name: string;
    readonly description?: string;
    readonly id?: string;
    readonly apiVersion?: string;
    readonly kind?: string;
    readonly 'x-kubernetes-group-version-kind'?: any[];
    properties?: { [key: string]: any };
}

export class KubernetesClusterSchemaHolder {
    private definitions: { [key: string]: KubernetesSchema } = {};
    private schemaEnums: { [key: string]: { [key: string]: [string[]] } };
    private crdSchemas: { [key: string]: object | undefined};

    public static async fromActiveCluster(kubectl: Kubectl): Promise<KubernetesClusterSchemaHolder> {
        const holder = new KubernetesClusterSchemaHolder();
        await holder.loadSchemaFromActiveCluster(kubectl, KUBERNETES_SCHEMA_ENUM_FILE());
        return holder;
    }

    public static fallback(): KubernetesClusterSchemaHolder {
        const holder = new KubernetesClusterSchemaHolder();
        const fallbackSchema = util.loadJson(FALLBACK_SCHEMA_FILE());
        holder.loadSchemaFromRaw(fallbackSchema, KUBERNETES_SCHEMA_ENUM_FILE(), undefined);
        return holder;
    }

    private async loadSchemaFromActiveCluster(kubectl: Kubectl, schemaEnumFile?: string): Promise<void> {
        const clusterSwagger = await swagger.getClusterSwagger(kubectl);
        const fetchCRDSchemasEnabled = await this.isFetchingCRDsAllowed(kubectl);
        if (fetchCRDSchemasEnabled) {
            const crdSchemas = await swagger.getCrdSchemas(kubectl);
            if (crdSchemas) {
                this.crdSchemas = crdSchemas;
            }
        }
        const schemaRaw = succeeded(clusterSwagger) ? this.definitionsObject(clusterSwagger.result) : util.loadJson(FALLBACK_SCHEMA_FILE());
        this.loadSchemaFromRaw(schemaRaw, schemaEnumFile, kubectl);
    }

    private async isFetchingCRDsAllowed(kubectl: Kubectl): Promise<boolean> {
        const codeCompletionState = await getCRDCodeCompletionState();
        if (codeCompletionState !== undefined) {
            return codeCompletionState === 'enabled';
        }

        const crdsTypesNumber = await kubectlUtils.getCRDTypesNumber(kubectl);
        if (failed(crdsTypesNumber)) {
            return false;
        }
        let action: string | undefined;
        if (crdsTypesNumber.result > 50) {
            action = await vscode.window.showInformationMessage(
                "This cluster contains many CRDs and by fetching them your VSCode instance could slow down. " +
                "You may skip fetching the CRDs, but this will disable code completion for custom resources. " +
                "Do you want to disable the CRD code completion? ",
                "Disable Once",
                "Always Disabled",
                "Enable Once",
                "Always Enabled"
                );
            if (!action
                || action === 'Disable Once') {
                return false;
            } else if (action === 'Always Disabled') {
                setCRDCodeCompletion(false);
                return false;
            } else if (action === 'Always Enabled') {
                setCRDCodeCompletion(true);
            }
        }

        return true;
    }

    private definitionsObject(swagger: any): any {
        return {
            definitions: swagger.definitions
        };
    }

    private loadSchemaFromRaw(schemaRaw: any, schemaEnumFile?: string, kubectl?: Kubectl): void {
        this.schemaEnums = schemaEnumFile ? util.loadJson(schemaEnumFile) : {};
        const definitions = schemaRaw.definitions;
        makeSafeIntOrString(definitions);
        for (const name of Object.keys(definitions)) {
            this.saveSchemaWithManifestStyleKeys(name, definitions[name]);
        }

        for (const schema of _.values(this.definitions) ) {
            if (kubectl &&
                this.crdSchemas &&
                schema.id &&
                schema.id.toLowerCase() in this.crdSchemas)  {
                    const crdProperties = this.crdSchemas[schema.id.toLowerCase()];
                    if (crdProperties) {
                        schema.properties = crdProperties;
                    }
            }
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
    public lookup(key: string): KubernetesSchema | undefined {
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
                    ...schema,
                    name
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
                    if (propSchema.type === "array" && propSchema.items) {
                        propSchema.items.enum = this.schemaEnums[node.name][propKey];
                    } else {
                        propSchema.enum = this.schemaEnums[node.name][propKey];
                    }
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
    const schemas = Array.of<KubernetesSchema>();
    // eg: service, pod, deployment
    const groupKindNode = originalSchema[KUBERNETES_GROUP_VERSION_KIND];

    // delete 'x-kubernetes-group-version-kind' since it is not a schema standard, it is only a selector
    delete originalSchema[KUBERNETES_GROUP_VERSION_KIND];

    groupKindNode.forEach((groupKindNode: any) => {
        const gvk = util.parseKubernetesGroupVersionKind(groupKindNode);
        if (!gvk) {
            return;
        }

        const { id, apiVersion, kind } = gvk;

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

function makeSafeIntOrString(definitions: any): void {
    // We need to tweak the IntOrString schema because the live schema has
    // it as type 'string' with format 'int-or-string', and this doesn't
    // play nicely with Red Hat YAML on Mac or Linux - it presents a validation
    // warning on unquoted integers saying they should be strings. This schema
    // is more semantically correct and appears to restore the correct behaviour
    // from RH YAML.
    const intOrStringDefinition = definitions['io.k8s.apimachinery.pkg.util.intstr.IntOrString'];
    if (intOrStringDefinition) {
        if (intOrStringDefinition.type === 'string') {
            intOrStringDefinition.oneOf = [
                { type: 'string' },
                { type: 'integer' }
            ];
            delete intOrStringDefinition.type;
        }
    }
}
