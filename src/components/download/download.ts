const home = process.env['HOME'];

import * as download_core from 'download';  // NEVER do a naked import of this as it corrupts $HOME on Windows - use wrapper functions from this module (or export the download function from this module if you really need the flexibility of the core implementation)
import * as path from 'path';
import * as stream from 'stream';
import * as tmp from 'tmp';

import { succeeded, Errorable } from '../../errorable';

// Fix download module corrupting HOME environment variable on Windows
// See https://github.com/Azure/vscode-kubernetes-tools/pull/302#issuecomment-404678781
// and https://github.com/kevva/npm-conf/issues/13
if (home) {
    process.env['HOME'] = home;
}

type DownloadFunc =
    (url: string, destination?: string, options?: any)
         => Promise<Buffer> & stream.Duplex; // Stream has additional events - see https://www.npmjs.com/package/download

const download: DownloadFunc = download_core;

export async function toTempFile(sourceUrl: string): Promise<Errorable<string>> {
    const tempFileObj = tmp.fileSync({ prefix: "vsk-autoinstall-" });
    const downloadResult = await to(sourceUrl, tempFileObj.name);
    if (succeeded(downloadResult)) {
        return { succeeded: true, result: tempFileObj.name };
    }
    return { succeeded: false, error: downloadResult.error };
}

export async function to(sourceUrl: string, destinationFile: string): Promise<Errorable<void>> {
    try {
        await download(sourceUrl, path.dirname(destinationFile), { filename: path.basename(destinationFile) });
        return { succeeded: true, result: null };
    } catch (e) {
        return { succeeded: false, error: [e.message] };
    }
}
