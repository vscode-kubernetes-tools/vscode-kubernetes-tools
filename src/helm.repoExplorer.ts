import * as path from 'path';
import * as vscode from 'vscode';

import { Host } from './host';
import * as helm from './helm.exec';
import { Errorable, failed } from './errorable';

export function create(host: Host): HelmRepoExplorer {
    return new HelmRepoExplorer(host);
}

interface HelmRepo {
    readonly name: string;
    readonly url: string;
}

export class HelmRepoExplorer implements vscode.TreeDataProvider<HelmRepo> {
    private onDidChangeTreeDataEmitter: vscode.EventEmitter<HelmRepo | undefined> = new vscode.EventEmitter<HelmRepo | undefined>();
    readonly onDidChangeTreeData: vscode.Event<HelmRepo | undefined> = this.onDidChangeTreeDataEmitter.event;

    constructor(private readonly host: Host) {
        host.onDidChangeConfiguration((change) => {
            if (change.affectsConfiguration('vs-kubernetes')) {
                this.refresh();
            }
        });
    }

    getTreeItem(element: HelmRepo): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(element.name);
        treeItem.iconPath = {
            light: vscode.Uri.file(path.join(__dirname, "../../images/light/helm-blue-vector.svg")),
            dark: vscode.Uri.file(path.join(__dirname, "../../images/dark/helm-white-vector.svg")),
        };
        return treeItem;
    }

    getChildren(parent?: any): vscode.ProviderResult<HelmRepo[]> {
        if (parent) {
            return [];
        }

        return this.getHelmRepos();
    }

    private async getHelmRepos(): Promise<HelmRepo[]> {
        const repos = await listHelmRepos();
        if (failed(repos)) {
            return [ { name: 'Unable to list Helm repos', url: '' } ];
        }
        return repos.result;
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }
}

async function listHelmRepos(): Promise<Errorable<HelmRepo[]>> {
    const sr = await helm.helmExecAsync("repo list");
    if (sr.code !== 0) {
        return { succeeded: false, error: [sr.stderr] };
    }

    const repos = sr.stdout.split('\n')
                           .slice(1)
                           .map((l) => l.trim())
                           .map((l) => l.split('\t').map((bit) => bit.trim()))
                           .map((bits) => ({ name: bits[0], url: bits[1] }));
    return { succeeded: true, result: repos };
}
