import * as download from '../../components/download/download';
import { Errorable, failed } from "../../errorable";
import { Kubectl } from "../../kubectl";
import { proxy } from "../kubectl/proxy";
import { fs } from '../../fs';
import { isSafeResourceType } from '../kubectl/resource-commands';
import { KubernetesResource } from '../../kuberesources.objectmodel';
import { ExecResult } from '../../binutilplusplus';

export type Swagger = any;

interface CustomResourceDefinition extends KubernetesResource {
    readonly spec: {
        readonly group: string;
        readonly names: {
            readonly plural: string;
            readonly singular: string;
        };
        readonly versions?: {
            readonly name: string;
            readonly schema?: {
                readonly openAPIV3Schema?: {
                    readonly properties?: object;
                };
            };
        }[];
    };
}

export async function getClusterSwagger(kubectl: Kubectl): Promise<Errorable<Swagger>> {
    const proxyResult = await proxy(kubectl, 'random');
    if (failed(proxyResult)) {
        return proxyResult;
    }

    const proxySession = proxyResult.result;

    try {
        const uri = `http://localhost:${proxySession.port}/openapi/v2`;  // TODO: /swagger.json for server version <1.10
        const swaggerDownload = await download.toTempFile(uri);
        if (failed(swaggerDownload)) {
            return swaggerDownload;
        }

        const swaggerTempFile = swaggerDownload.result;

        try {
            const swaggerText = await fs.readTextFile(swaggerTempFile);
            const swagger = JSON.parse(swaggerText);
            return { succeeded: true, result: swagger };
        } finally {
            await fs.unlinkAsync(swaggerTempFile);
        }
    } finally {
        proxySession.dispose();
    }
}

export async function getCrdSchemas(kubectl: Kubectl): Promise<{[key: string]: object | undefined} | undefined> {
    const jsonPath = '{range .items[*]}{"\\n"}{.spec.group}{"\\t"}{.spec.names.plural}{"\\t"}{.spec.names.singular}{"\\t"}{range .spec.versions[?(@.schema.openAPIV3Schema.properties)]}{.name}{","}{end}{end}';
    const result = await kubectl.invokeCommandArgs(['get', 'crd', '-o', `jsonpath=${jsonPath}`]);
    if (ExecResult.failed(result)) {
        await kubectl.reportFailure(result, { whatFailed: 'Failed to get crds' });
        return;
    }
    const crdSchemasMapping: { [key: string]: object } = {};
    for (const line of result.stdout.split(/\r?\n/).filter((value) => value.length > 0)) {
        const fields = line.split('\t');
        if (fields.length !== 4) {
            continue;
        }
        const [group, plural, singular, versionList] = fields;
        if (![group, plural, singular].every(isSafeResourceType)) {
            continue;
        }
        const versions = versionList.split(',').filter((version) => version.length > 0 && isSafeResourceType(version));
        if (versions.length === 0) {
            continue;
        }
        const crd = await kubectl.asJsonArgs<CustomResourceDefinition>([
            'get', `crd/${plural}.${group}`, '-o', 'json'
        ]);
        if (failed(crd)) {
            continue;
        }
        const versionObjects = Array.isArray(crd.result?.spec?.versions) ? crd.result.spec.versions : [];
        for (const versionName of versions) {
            const version = versionObjects.find((candidate) => candidate && candidate.name === versionName);
            const properties = version?.schema?.openAPIV3Schema?.properties;
            if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
                crdSchemasMapping[`${group}/${versionName}@${singular}`] = properties;
            }
        }
    }
    return crdSchemasMapping;
}
