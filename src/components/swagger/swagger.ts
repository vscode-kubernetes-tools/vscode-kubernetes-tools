import * as download from '../../components/download/download';
import { Errorable, failed } from "../../errorable";
import { Kubectl } from "../../kubectl";
import { proxy } from "../kubectl/proxy";
import { fs } from '../../fs';

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
            // TODO: Looks like we need to post-process out the enum definitions per https://github.com/Azure/vscode-kubernetes-tools/pull/243/files
            return { succeeded: true, result: swagger };
        } finally {
            await fs.unlinkAsync(swaggerTempFile);
        }
    } finally {
        proxySession.dispose();
    }
}
