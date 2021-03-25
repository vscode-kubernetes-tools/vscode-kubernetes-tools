import { Uri, FileSystemProvider, FileType, FileStat, FileChangeEvent, Event, EventEmitter, Disposable } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as querystring from 'querystring';

import { Kubectl } from './kubectl';
import { Host } from './host';
import { helmSyntaxVersion, HelmSyntaxVersion, helmInvokeCommandWithFeedback } from './helm.exec';
import * as config from './components/config/config';
import { ExecResult } from './binutilplusplus';
import { Errorable } from './errorable';

export const K8S_RESOURCE_SCHEME = "k8smsx";
export const K8S_RESOURCE_SCHEME_READONLY = "k8smsxro";
export const KUBECTL_RESOURCE_AUTHORITY = "loadkubernetescore";
export const KUBECTL_DESCRIBE_AUTHORITY = "kubernetesdescribe";
export const HELM_RESOURCE_AUTHORITY = "helmget";

export function kubefsUri(namespace: string | null | undefined /* TODO: rationalise null and undefined */, value: string, outputFormat: string, action?: string): Uri {
    const docname = `${value.replace('/', '-')}${outputFormat !== '' ? '.' + outputFormat : ''}`;
    const nonce = new Date().getTime();
    const nsquery = namespace ? `ns=${namespace}&` : '';
    const scheme = action === 'describe' ? K8S_RESOURCE_SCHEME_READONLY : K8S_RESOURCE_SCHEME;
    const authority = action === 'describe' ? KUBECTL_DESCRIBE_AUTHORITY : KUBECTL_RESOURCE_AUTHORITY;
    const uri = `${scheme}://${authority}/${docname}?${nsquery}value=${value}&_=${nonce}`;
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
        const revision = query.revision as string | undefined;
        const ns = query.ns as string | undefined;
        const resourceAuthority = uri.authority;

        const eer = await this.execLoadResource(resourceAuthority, ns, value, revision, outputFormat);

        if (Errorable.failed(eer)) {
            this.host.showErrorMessage(eer.error[0]);
            throw eer.error[0];
        }

        const er = eer.result;

        if (ExecResult.failed(er)) {
            const message = ExecResult.failureMessage(er, { whatFailed: 'Get command failed'});
            if (er.resultKind === 'exec-bin-not-found') {
                this.kubectl.promptInstallDependencies(er, message);  // It doesn't matter which bincontext we go through for this  // TODO: have a shared exec context with the host, shell and fs members
            } else {
                this.host.showErrorMessage(message);
            }
            throw message;
        }

        return er.stdout;
    }

    async execLoadResource(resourceAuthority: string, ns: string | undefined, value: string, revision: string | undefined, outputFormat: string): Promise<Errorable<ExecResult>> {
        const nsarg = ns ? `--namespace ${ns}` : '';
        switch (resourceAuthority) {
            case KUBECTL_RESOURCE_AUTHORITY:
                const ker = await this.kubectl.invokeCommandWithFeedback(`-o ${outputFormat} ${nsarg} get ${value}`, `Loading ${value}...`);
                return { succeeded: true, result: ker };
            case HELM_RESOURCE_AUTHORITY:
                const scopearg = ((await helmSyntaxVersion()) === HelmSyntaxVersion.V2) ? '' : 'all';
                const revarg = revision ? ` --revision=${revision}` : '';
                const her = await helmInvokeCommandWithFeedback(`get ${scopearg} ${value}${revarg}`, `Loading ${value}...`);
                return { succeeded: true, result: her };
            case KUBECTL_DESCRIBE_AUTHORITY:
                const describe = await this.kubectl.invokeCommandWithFeedback(`describe ${value} ${nsarg}`, `Loading ${value}...`);
                return { succeeded: true, result: describe };
            default:
                return { succeeded: false, error: [`Internal error: please raise an issue with the error code InvalidObjectLoadURI and report authority ${resourceAuthority}.`] };
        }
    }

    writeFile(uri: Uri, content: Uint8Array, _options: { create: boolean; overwrite: boolean }): void | Thenable<void> {
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
