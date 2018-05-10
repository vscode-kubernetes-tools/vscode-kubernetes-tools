import * as vscode from 'vscode';
import { Uri, FileType } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export const K8S_RESOURCE_SCHEME = "k8smsx";

export class KubernetesResourceVirtualFileSystemProvider implements vscode.FileSystemProvider {

    private readonly _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]> = new vscode.EventEmitter<vscode.FileChangeEvent[]>();

    onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._onDidChangeFile.event;

    watch(uri, options): vscode.Disposable {
        return new vscode.Disposable(() => {});
    }

    stat(uri): vscode.FileStat {
        return {
            type: vscode.FileType.File,
            ctime: 0,
            mtime: 0,
            size: 65536  // TODO: determine if these fields matter
        };
    }

    readDirectory(uri: Uri): [string, FileType][] | Thenable<[string, FileType][]> {
        return [];
    }

    createDirectory(uri: Uri): void | Thenable<void> {
        // no-op
    }

    readFile(uri: Uri): Uint8Array | Thenable<Uint8Array> {
        return new Buffer(`TODO: work out what goes here`, 'utf8');
    }

    writeFile(uri: Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void | Thenable<void> {
        // TODO: create directories if necessary (also need to figure out Save As strategy)
        const fspath = path.join(vscode.workspace.rootPath, uri.fsPath);
        fs.writeFileSync(fspath, content);
    }

    delete(uri: Uri, options: { recursive: boolean }): void | Thenable<void> {
        // no-op for now
    }

    rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean }): void | Thenable<void> {
        // no-op
    }
}
