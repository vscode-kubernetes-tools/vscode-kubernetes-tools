import { Uri, FileSystemProvider, FileType, FileStat, FileChangeEvent, Event, EventEmitter, Disposable, workspace } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as querystring from 'querystring';

import { Kubectl } from './kubectl';
import { Host } from './host';

export const K8S_RESOURCE_SCHEME = "k8smsx";

export class KubernetesResourceVirtualFileSystemProvider implements FileSystemProvider {
    constructor(private readonly kubectl: Kubectl, private readonly host: Host, private readonly rootPath: string) { }

    private readonly _onDidChangeFile: EventEmitter<FileChangeEvent[]> = new EventEmitter<FileChangeEvent[]>();

    onDidChangeFile: Event<FileChangeEvent[]> = this._onDidChangeFile.event;

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
        const outputFormat = workspace.getConfiguration('vs-kubernetes')['vs-kubernetes.outputFormat'];
        const value = querystring.parse(uri.query).value;
        const sr = await this.kubectl.invokeAsyncWithProgress(`-o ${outputFormat} get ${value}`, `Loading ${value}...`);

        if (sr.code !== 0) {
            this.host.showErrorMessage('Get command failed: ' + sr.stderr);
            throw sr.stderr;
        }

        return sr.stdout;
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
