import * as path from 'path';
import * as stream from 'stream';
import * as tmp from 'tmp';

import { succeeded, Errorable } from '../../errorable';
import { Dictionary } from '../../utils/dictionary';
import { sleep } from '../../sleep';

type DownloadFunc =
    (url: string, destination?: string, options?: any)
         => Promise<Buffer> & stream.Duplex; // Stream has additional events - see https://www.npmjs.com/package/download

let download: DownloadFunc | undefined;

const DOWNLOAD_ONCE_STATUS = Dictionary.of<DownloadOperationStatus>();

enum DownloadOperationStatus {
    Queued = 1,
    Completed = 2,
    Failed = 3,
}

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

export async function to(sourceUrl: string, destinationFile: string): Promise<Errorable<null>> {
    ensureDownloadFunc();
    try {
        await download!(sourceUrl, path.dirname(destinationFile), { filename: path.basename(destinationFile) });  // safe because we ensured it
        return { succeeded: true, result: null };
    } catch (e) {
        return { succeeded: false, error: [e.message] };
    }
}

export async function once(sourceUrl: string, destinationFile: string): Promise<Errorable<null>> {
    const downloadStatus = DOWNLOAD_ONCE_STATUS[destinationFile];
    if (!downloadStatus || downloadStatus === DownloadOperationStatus.Failed) {
        DOWNLOAD_ONCE_STATUS[destinationFile] = DownloadOperationStatus.Queued;
        const result = await to(sourceUrl, destinationFile);
        DOWNLOAD_ONCE_STATUS[destinationFile] = succeeded(result) ? DownloadOperationStatus.Completed : DownloadOperationStatus.Failed;
        return result;
    } else {
        while (true) {
            await sleep(100);
            if (DOWNLOAD_ONCE_STATUS[destinationFile] === DownloadOperationStatus.Completed) {
                return { succeeded: true, result: null };
            }
            else {
                return await once(sourceUrl, destinationFile);
            }
        }
    }
}
