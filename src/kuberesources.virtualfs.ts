import { Uri, FileSystemProvider, FileType, FileStat, FileChangeEvent, Event, EventEmitter, Disposable, workspace } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as querystring from 'querystring';

import { Kubectl } from './kubectl';
import { Host } from './host';
import { ShellResult } from './shell';
import { helmExecAsync } from './helm.exec';

export const K8S_RESOURCE_SCHEME = "k8smsx";
export const KUBECTL_RESOURCE_AUTHORITY = "loadkubernetescore";
export const HELM_RESOURCE_AUTHORITY = "helmget";

export class KubernetesResourceVirtualFileSystemProvider implements FileSystemProvider {
    constructor(private readonly kubectl: Kubectl, private readonly host: Host, private readonly rootPath: string) { }

    private readonly onDidChangeFileEmitter: EventEmitter<FileChangeEvent[]> = new EventEmitter<FileChangeEvent[]>();

    onDidChangeFile: Event<FileChangeEvent[]> = this.onDidChangeFileEmitter.event;

    watch(uri: Uri, options: { recursive: boolean; excludes: string[] }): Disposable {
        // It would be quite neat to implement this to watch for changes
        // in the cluster and update the doc accordingly.  But that is very
        // definitely a future enhancement thing!
        return new Disposable(() => {});
    }

    stat(uri: Uri): FileStat {
        return {
            type: FileType.File,
            ctime: 0,
            mtime: 0,
            size: 65536  // These files don't seem to matter for us
        };
    }

    readDirectory(uri: Uri): [string, FileType][] | Thenable<[string, FileType][]> {
        return [];
    }

    createDirectory(uri: Uri): void | Thenable<void> {
        // no-op
    }

    readFile(uri: Uri): Uint8Array | Thenable<Uint8Array> {
        return this.readFileAsync(uri);
    }

    async readFileAsync(uri: Uri): Promise<Uint8Array> {
        const content = await this.loadResource(uri);
        return new Buffer(content, 'utf8');
    }

    async loadResource(uri: Uri): Promise<string> {
        const query = querystring.parse(uri.query);

        const outputFormat = workspace.getConfiguration('vs-kubernetes')['vs-kubernetes.outputFormat'];
        const value = query.value;
        const ns = query.ns;
        const resourceAuthority = uri.authority;

        const sr = await this.execLoadResource(resourceAuthority, ns, value, outputFormat);

        if (sr.code !== 0) {
            this.host.showErrorMessage('Get command failed: ' + sr.stderr);
            throw sr.stderr;
        }

        return sr.stdout;
    }

    async execLoadResource(resourceAuthority: string, ns: string | undefined, value: string, outputFormat: string): Promise<ShellResult> {
        switch (resourceAuthority) {
            case KUBECTL_RESOURCE_AUTHORITY:
                const nsarg = ns ? `--namespace ${ns}` : '';
                return await this.kubectl.invokeAsyncWithProgress(`-o ${outputFormat} ${nsarg} get ${value}`, `Loading ${value}...`);
            case HELM_RESOURCE_AUTHORITY:
                return await helmExecAsync(`get ${value}`);
            default:
                return { code: -99, stdout: '', stderr: `Internal error: please raise an issue with the error code InvalidObjectLoadURI and report authority ${resourceAuthority}.` };
        }
    }

    writeFile(uri: Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void | Thenable<void> {
        // This assumes no pathing in the URI - if this changes, we'll need to
        // create subdirectories.
        const fspath = path.join(this.rootPath, uri.fsPath);
        fs.writeFileSync(fspath, content);
    }

    delete(uri: Uri, options: { recursive: boolean }): void | Thenable<void> {
        // no-op
    }

    rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean }): void | Thenable<void> {
        // no-op
    }
}
