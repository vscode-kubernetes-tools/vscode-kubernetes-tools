import * as download from '../../components/download/download';
import { Errorable, failed } from "../../errorable";
import { Kubectl } from "../../kubectl";
import { proxy } from "../kubectl/proxy";
import { fs } from '../../fs';
import * as kubectlUtils from '../../kubectlUtils';
import { ExecResult } from '../../binutilplusplus';

export type Swagger = any;

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
    const er = await kubectl.invokeCommand(`get crd -o jsonpath="{range .items[*].spec}[{.group}, {.names.plural}, {.names.singular}, {range .versions[?(.schema.openAPIV3Schema.properties)]}{.name}{\\" \\"}{end}]{end}"`);

    if (ExecResult.failed(er)) {
        kubectl.reportFailure(er, { whatFailed: 'Failed to get crds' });
        return;
    }
    try {
        const crdSchemasMapping: { [key: string]: object } = {};
        const crdInfos = er.stdout.substring(1).split('[');
        for (const crdInfo of crdInfos) {
            const crdInfoAsArray = crdInfo.split(',');
            const group = crdInfoAsArray[0].trim();
            const plural = crdInfoAsArray[1].trim();
            const singular = crdInfoAsArray[2].trim();
            const versions = crdInfoAsArray[3].trim() !== '' ? crdInfoAsArray[3].trim().split(' ') : [];
            if (versions.length > 0) {
                const crd =  await kubectlUtils.getResourceAsJson<any>(kubectl, `crd ${plural}.${group}`, '', true);
                if (!crd) {
                    continue;
                }
                for (const version of versions) {
                    const versionObject = crd.spec.versions ? crd.spec.versions.filter((v: { name: string }) => v.name === version) : [];
                    crdSchemasMapping[`${group}/${version}@${singular}`] = versionObject.length > 0 ? versionObject[0].schema.openAPIV3Schema.properties : undefined;
                }
            }
        }
        return crdSchemasMapping;
    } catch (e) { }
    return;
}
