import * as path from 'path';
import * as stream from 'stream';
import * as tmp from 'tmp';

import { succeeded, Errorable } from '../../errorable';

type DownloadFunc =
    (url: string, destination?: string, options?: any)
         => Promise<Buffer> & stream.Duplex; // Stream has additional events - see https://www.npmjs.com/package/download

let download: DownloadFunc;

function ensureDownloadFunc() {
    if (!download) {
        // Fix download module corrupting HOME environment variable on Windows
        // See https://github.com/Azure/vscode-kubernetes-tools/pull/302#issuecomment-404678781
        // and https://github.com/kevva/npm-conf/issues/13
        const home = process.env['HOME'];
        download = require('download');
        if (home) {
            process.env['HOME'] = home;
        }
    }
}

export async function toTempFile(sourceUrl: string): Promise<Errorable<string>> {
    const tempFileObj = tmp.fileSync({ prefix: "vsk-autoinstall-" });
    const downloadResult = await to(sourceUrl, tempFileObj.name);
    if (succeeded(downloadResult)) {
        return { succeeded: true, result: tempFileObj.name };
    }
    return { succeeded: false, error: downloadResult.error };
}

export async function to(sourceUrl: string, destinationFile: string): Promise<Errorable<void>> {
    ensureDownloadFunc();
    try {
        await download(sourceUrl, path.dirname(destinationFile), { filename: path.basename(destinationFile) });
        return { succeeded: true, result: null };
    } catch (e) {
        return { succeeded: false, error: [e.message] };
    }
}
