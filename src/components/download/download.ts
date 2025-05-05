import * as path from 'path';
import * as fs from 'fs';
import * as tmp from 'tmp';
import fetch from 'node-fetch';             

import { succeeded, Errorable } from '../../errorable';
import { Dictionary } from '../../utils/dictionary';
import { sleep } from '../../sleep';

type DownloadFunc =
    (url: string, destinationDir?: string, options?: { filename: string })
         => Promise<Buffer>;

let download: DownloadFunc | undefined;

const DOWNLOAD_ONCE_STATUS = Dictionary.of<DownloadOperationStatus>();

enum DownloadOperationStatus {
    Queued = 1,
    Completed = 2,
    Failed = 3,
}

function ensureDownloadFunc() {
    if (!download) {
        download = (async (url: string, destinationDir?: string, options?: any) => {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
            }
            const data = await res.buffer();
            const dir = destinationDir || process.cwd();
            const filename = options?.filename || path.basename(url);
            const destPath = path.join(dir, filename);
            await fs.promises.mkdir(dir, { recursive: true });
            await fs.promises.writeFile(destPath, data);
            return data;
        }) as unknown as DownloadFunc;
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
        await download!(sourceUrl, path.dirname(destinationFile), { filename: path.basename(destinationFile) });
        return { succeeded: true, result: null };
    } catch (e: any) {
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
            } else if (DOWNLOAD_ONCE_STATUS[destinationFile] === DownloadOperationStatus.Failed) {
                // one retry
                return await once(sourceUrl, destinationFile);
            }
        }
    }
}
