import { Uri, FileSystemProvider, FileType, FileStat, FileChangeEvent, Event, EventEmitter, Disposable } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as querystring from 'querystring';

import { Kubectl } from './kubectl';
import { Host } from './host';
import { ShellResult } from './shell';
import { helmExecAsync, helmSyntaxVersion, HelmSyntaxVersion } from './helm.exec';
import * as config from './components/config/config';

export const K8S_RESOURCE_SCHEME = "k8smsx";
export const KUBECTL_RESOURCE_AUTHORITY = "loadkubernetescore";
export const HELM_RESOURCE_AUTHORITY = "helmget";

export function kubefsUri(namespace: string | null | undefined /* TODO: rationalise null and undefined */, value: string, outputFormat: string): Uri {
    const docname = `${value.replace('/', '-')}.${outputFormat}`;
    const nonce = new Date().getTime();
    const nsquery = namespace ? `ns=${namespace}&` : '';
    const uri = `${K8S_RESOURCE_SCHEME}://${KUBECTL_RESOURCE_AUTHORITY}/${docname}?${nsquery}value=${value}&_=${nonce}`;
    return Uri.parse(uri);
}

export class KubernetesResourceVirtualFileSystemProvider implements FileSystemProvider {
    constructor(private readonly kubectl: Kubectl, private readonly host: Host) { }

    private readonly onDidChangeFileEmitter: EventEmitter<FileChangeEvent[]> = new EventEmitter<FileChangeEvent[]>();

    onDidChangeFile: Event<FileChangeEvent[]> = this.onDidChangeFileEmitter.event;

    watch(_uri: Uri, _options: { recursive: boolean; excludes: string[] }): Disposable {
        // It would be quite neat to implement this to watch for changes
        // in the cluster and update the doc accordingly.  But that is very
        // definitely a future enhancement thing!
        return new Disposable(() => {});
    }

    stat(_uri: Uri): FileStat {
        return {
            type: FileType.File,
            ctime: 0,
            mtime: 0,
            size: 65536  // These files don't seem to matter for us
        };
    }

    readDirectory(_uri: Uri): [string, FileType][] | Thenable<[string, FileType][]> {
        return [];
    }

    createDirectory(_uri: Uri): void | Thenable<void> {
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

        const outputFormat = config.getOutputFormat();
        const value = query.value as string;
        const ns = query.ns as string | undefined;
        const resourceAuthority = uri.authority;

        const sr = await this.execLoadResource(resourceAuthority, ns, value, outputFormat);

        if (!sr || sr.code !== 0) {
            const message = sr ? sr.stderr : "Unable to run command line tool";
            this.host.showErrorMessage('Get command failed: ' + message);
            throw message;
        }

        return sr.stdout;
    }

    async execLoadResource(resourceAuthority: string, ns: string | undefined, value: string, outputFormat: string): Promise<ShellResult | undefined> {
        switch (resourceAuthority) {
            case KUBECTL_RESOURCE_AUTHORITY:
                const nsarg = ns ? `--namespace ${ns}` : '';
                return await this.kubectl.invokeAsyncWithProgress(`-o ${outputFormat} ${nsarg} get ${value}`, `Loading ${value}...`);
            case HELM_RESOURCE_AUTHORITY:
                const scopearg = ((await helmSyntaxVersion()) === HelmSyntaxVersion.V2) ? '' : 'all';
                return await helmExecAsync(`get ${scopearg} ${value}`);
            default:
                return { code: -99, stdout: '', stderr: `Internal error: please raise an issue with the error code InvalidObjectLoadURI and report authority ${resourceAuthority}.` };
        }
    }

    writeFile(uri: Uri, content: Uint8Array, _options: { create: boolean, overwrite: boolean }): void | Thenable<void> {
        return this.saveAsync(uri, content);  // TODO: respect options
    }

    private async saveAsync(uri: Uri, content: Uint8Array): Promise<void> {
        // This assumes no pathing in the URI - if this changes, we'll need to
        // create subdirectories.
        // TODO: not loving prompting as part of the write when it should really be part of a separate
        // 'save' workflow - but needs must, I think
        const rootPath = await this.host.selectRootFolder();
        if (!rootPath) {
            return;
        }
        const fspath = path.join(rootPath, uri.fsPath);
        fs.writeFileSync(fspath, content);
    }

    delete(_uri: Uri, _options: { recursive: boolean }): void | Thenable<void> {
        // no-op
    }

    rename(_oldUri: Uri, _newUri: Uri, _options: { overwrite: boolean }): void | Thenable<void> {
        // no-op
    }
}
