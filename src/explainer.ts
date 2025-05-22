'use strict';

import fetch, { RequestInit } from "node-fetch";
import * as https from "https";
import * as kubernetes from '@kubernetes/client-node';
import * as pluralize from 'pluralize';

import { formatComplex, formatOne, Typed, formatType } from "./schema-formatting";
import { loadKubeconfig } from './components/kubectl/kubeconfig';

export interface SwaggerModel {
    readonly definitions: any[];
}

export async function readSwagger(): Promise<SwaggerModel | undefined> {
    return readSwaggerCore(await loadKubeconfig());
}

export async function readSwaggerCore(kc: kubernetes.KubeConfig): Promise<any | undefined> {
  const currentCluster = kc.getCurrentCluster();
  if (!currentCluster) return undefined;

  const uri = `${currentCluster.server}/swagger.json`;

  // Prepare HTTPS options and agent
  const httpsOptions: https.AgentOptions = {};
  kc.applyToHTTPSOptions(httpsOptions);
  const agent = new https.Agent(httpsOptions);

  // Configure fetch request
  const fetchOptions: RequestInit = {
    method: "GET",
    agent,
  };

  try {
    const res = await fetch(uri, fetchOptions);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    return json;
  } catch (error: any) {
    console.error("Failed to fetch swagger.json:", error.message);
    throw error;
  }
}

export function readExplanation(swagger: SwaggerModel, fieldsPath: string) {
    const fields = fieldsPath.split('.');
    const kindName = fields.shift()!;
    const kindDef = findKindModel(swagger, kindName);
    if (!kindDef) {
        return `No explanation available for ${fieldsPath}`;
    }
    const text = chaseFieldPath(swagger, kindDef, kindName, fields);
    return text;
}

function findKindModel(swagger: SwaggerModel, kindName: string): TypeModel | undefined {
    // TODO: use apiVersion (e.g. v1, extensions/v1beta1) to help locate these
    const v1def = findProperty(swagger.definitions, 'v1.' + kindName);
    const v1beta1def = findProperty(swagger.definitions, 'v1beta1.' + kindName);
    const kindDef = v1def || v1beta1def;
    return kindDef;
}

function chaseFieldPath(swagger: any, currentProperty: TypeModel, currentPropertyName: string, fields: string[]): string {

    // What are our scenarios?
    // 1. (ex: Deployment.[metadata]): We are at the end of the chain and
    //    are on a property with a $ref AND the $ref is of type 'object' and
    //    has a list of properties.  List the NAME and DESCRIPTION of the current property
    //    plus the DESCRIPTION of the type (e.g. 'Standard object metadata.\n\n
    //    ObjectMeta is metadata that...'), followed by a list of properties
    //    of the type (name + type + description).
    // 2. (ex: Deployment.[metadata].generation): We are in the midle of the chain,
    //    and are on a property with a $ref AND the $ref is of type 'object' and
    //    has a list of properties.  Locate the property in the $ref corresponding to the NEXT
    //    element in the chain, and move to that.
    // 2a. (ex: Deployment.[metadata].biscuits): We are in the middle of the chain,
    //    and are on a property with a $ref AND the $ref is of type 'object' and
    //    has a list of properties, BUT there is no property corresponding to the
    //    next element in the chain.  Report an error; the kubectl message is
    //    "field 'biscuits' does not exist"
    // 3. (ex: Deployment.metadata.[generation]): We are at the end of the chain
    //    and are on a property with a type and no $ref.  List the NAME, TYPE and
    //    DESCRIPTION of the current property.
    // 3a. (ex: Deployment.metadata.[generation].biscuits): We are NOT at the end of
    //    the chain, but are on a property with a type and no $ref.  Treat as #3 and
    //    do not traverse (this is what kubectl does).  Basically in #3 we are allowed
    //    to ignore the end-of-chain check.
    // 4. (ex: Deployment.metadata.[annotations].*): We are in the middle of the chain,
    //    and are on a property WITHOUT a $ref but of type 'object'.  This is an
    //    unstructured key-value store scenario.  List the NAME, TYPE and DESCRIPTION
    //    of the current property.
    // 5. (ex: Deployment.metadata.[creationTimestamp]): We are on a property with a $ref,
    //    BUT the type of the $ref is NOT 'object' and it does NOT have a list of properties.
    //    List the NAME of the property, the TYPE of the $ref and DESCRIPTION of the property.
    // 6. (ex: [Deployment].metadata): We are in the middle of the chain, and are on a property
    //    WITHOUT a $ref, BUT it DOES have a list of properties.  Locate the property in the list
    //    corresponding to the NEXT element in the chain, and move to that.
    // 7. (ex: [Deployment]): We are at the end of the chain, and are on a property
    //    WITHOUT a $ref, BUT it DOES have a list of properties.  List the NAME and DESCRIPTION
    //    of the current property, followed by a list of child properties.
    //
    // Algorithm:
    // Are we on a property with a $ref?
    //   If YES:
    //     Does the $ref have a list of properties?
    //     If YES:
    //       Are we at the end of the chain?
    //       If YES:
    //         Case 1: List the NAME and DESCRIPTION of the current property, and the DESCRIPTION and CHILD PROPERTIES of the $ref.
    //       If NO:
    //         Does the $ref contain a property that matches the NEXT element in our chain?
    //         If YES:
    //           Case 2: Traverse to that property and recurse.
    //         If NO:
    //           Case 2a: Error: field does not exist
    //     If NO:
    //        Case 5: List the NAME of the current property, the TYPE of the $ref, and the DESCRIPTION of the current property.
    //   If NO:
    //     Does the current property have a list of properties?
    //     If YES:
    //       Are we at the end of the chain?
    //       If YES:
    //         Case 1: List the NAME and DESCRIPTION of the current property, and the CHILD PROPERTIES.
    //       If NO:
    //         Does the property list contain a property that matches the NEXT element in our chain?
    //         If YES:
    //           Case 2: Traverse to that property and recurse.
    //         If NO:
    //           Case 2a: Error: field does not exist
    //     If NO:
    //       Is the property of type 'object'?
    //       If YES:
    //         Case 4: List the NAME, TYPE and DESCRIPTION of the current property.  (Ignore subsequent elements in the chain.)
    //       If NO:
    //         Case 3/3a: List the NAME, TYPE and DESCRIPTION of the current property.  (Ignore subsequent elements in the chain.)
    //       [So cases 3, 3a and 4 are all the same really.]

    const currentPropertyTypeRef = currentProperty.$ref || (currentProperty.items ? currentProperty.items.$ref : undefined);

    if (currentPropertyTypeRef) {
        const typeDefnPath: string[] = currentPropertyTypeRef.split('/');
        typeDefnPath.shift();
        const currentPropertyTypeInfo = findTypeDefinition(swagger, typeDefnPath);
        if (currentPropertyTypeInfo) {
            const typeRefProperties = currentPropertyTypeInfo.properties;
            if (typeRefProperties) {
                if (fields.length === 0) {
                    return formatComplex(currentPropertyName, currentProperty.description, currentPropertyTypeInfo.description, typeRefProperties);
                } else {
                    const nextField = fields.shift()!;
                    const nextProperty = findProperty(typeRefProperties, nextField);
                    if (nextProperty) {
                        return chaseFieldPath(swagger, nextProperty, nextField, fields);
                    } else {
                        return explainError(nextField, 'field does not exist');
                    }
                }

            } else {
                return formatOne(currentPropertyName, formatType(currentPropertyTypeInfo), currentProperty.description);
            }
        } else {
            return explainError(currentPropertyTypeRef, 'unresolvable type reference');
        }
    } else {
        const properties = currentProperty.properties;
        if (properties) {
            if (fields.length === 0) {
                return formatComplex(currentPropertyName, currentProperty.description, undefined, properties);
            } else {
                const nextField = fields.shift()!;
                const nextProperty = findProperty(properties, nextField);
                if (nextProperty) {
                    return chaseFieldPath(swagger, nextProperty, nextField, fields);
                } else {
                    return explainError(nextField, 'field does not exist');
                }
            }
        } else {
            return formatOne(currentPropertyName, formatType(currentProperty), currentProperty.description);
        }
    }
}

function explainError(header: string, error: string) {
    return `**${header}:** ${error}`;
}

function singularizeVersionedName(name: string) {
    const bits = name.split('.');
    let lastBit = bits.pop()!;
    lastBit = pluralize.singular(lastBit);
    bits.push(lastBit);
    return bits.join('.');
}

function findProperty(obj: any, name: string): TypeModel | undefined {
    const n = name.toLowerCase();
    for (const p in obj) {
        const pinfo = obj[p];
        if (p.toLowerCase() === n) {
            return pinfo;
        }
        const gvks = pinfo["x-kubernetes-group-version-kind"];
        if (gvks && gvks.length && gvks.length > 0 && gvks[0]) {
            const gvk = gvks[0];
            const ver = gvk.version;
            const kind = gvk.kind;
            if (ver && kind) {
                const vk = `${ver}.${kind}`;
                if (vk.toLowerCase() === n) {
                    return pinfo;
                }
            }
        }
    }
    const singname = singularizeVersionedName(name);
    if (singname === name) {
        return undefined;
    } else {
        return findProperty(obj, singname);
    }
}

function findTypeDefinition(swagger: any, typeDefnPath: string[]): TypeModel | undefined {
    let m = swagger;
    for (const p of typeDefnPath) {
        m = findProperty(m, p);
        if (!m) {
            return undefined;
        }
    }
    return m;
}

// TODO: this isn't really a type model - it can be a type model (description + properties) *or* a property model (description + [type|$ref])
interface TypeModel extends Typed {
    readonly description?: string;
    readonly properties?: any;
}
