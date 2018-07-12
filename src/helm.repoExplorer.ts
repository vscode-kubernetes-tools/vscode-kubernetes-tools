import * as path from 'path';
import * as vscode from 'vscode';
import * as download from 'download';
import * as YAML from 'yamljs';

import { Host } from './host';
import * as helm from './helm.exec';
import { Errorable, failed } from './errorable';

export function create(host: Host): HelmRepoExplorer {
    return new HelmRepoExplorer(host);
}

interface HelmObject {
    getChildren(): Promise<HelmObject[]>;
    getTreeItem(): vscode.TreeItem;
}

export class HelmRepoExplorer implements vscode.TreeDataProvider<HelmObject> {
    private onDidChangeTreeDataEmitter: vscode.EventEmitter<HelmObject | undefined> = new vscode.EventEmitter<HelmObject | undefined>();
    readonly onDidChangeTreeData: vscode.Event<HelmObject | undefined> = this.onDidChangeTreeDataEmitter.event;

    constructor(private readonly host: Host) {
        host.onDidChangeConfiguration((change) => {
            if (change.affectsConfiguration('vs-kubernetes')) {
                this.refresh();
            }
        });
    }

    getTreeItem(element: HelmObject): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element.getTreeItem();
    }

    getChildren(parent?: HelmObject): vscode.ProviderResult<HelmObject[]> {
        if (parent) {
            return parent.getChildren();
        }

        return this.getHelmRepos();
    }

    private async getHelmRepos(): Promise<HelmObject[]> {
        const repos = await listHelmRepos();
        if (failed(repos)) {
            return [ new HelmError('Unable to list Helm repos') ];
        }
        return repos.result;
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }
}

class HelmError implements HelmObject {
    constructor(private readonly text: string) {}

    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem(this.text);
    }

    async getChildren(): Promise<HelmObject[]> {
        return [];
    }
}

class HelmRepo implements HelmObject {
    constructor(private readonly name: string, private readonly url: string) {}

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.name, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.iconPath = {
            light: vscode.Uri.file(path.join(__dirname, "../../images/light/helm-blue-vector.svg")),
            dark: vscode.Uri.file(path.join(__dirname, "../../images/dark/helm-white-vector.svg")),
        };
        return treeItem;
    }

    async getChildren(): Promise<HelmObject[]> {
        const charts = await listHelmRepoCharts(this.url);
        if (failed(charts)) {
            return [ new HelmError('Error fetching charts') ];
        }
        return charts.result;
    }
}

class HelmRepoChart implements HelmObject {
    constructor(private readonly name: string) {}

    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem(this.name);
    }

    async getChildren(): Promise<HelmObject[]> {
        return [];
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
                           .filter((l) => l.length > 0)
                           .map((l) => l.split('\t').map((bit) => bit.trim()))
                           .map((bits) => new HelmRepo(bits[0], bits[1]));
    return { succeeded: true, result: repos };
}

async function listHelmRepoCharts(repoUrl: string): Promise<Errorable<HelmRepoChart[]>> {
    const indexUrl = vscode.Uri.parse(repoUrl).with({ path: 'index.yaml' }).toString();
    try {
        const charts = await listHelmRepoChartsCore(indexUrl);
        return { succeeded: true, result: charts };
    } catch (e) {
        if (vscode.Uri.parse(repoUrl).authority.indexOf("127.0.0.1") >= 0) {
            const d = await helm.helmServe();
            try {
                const charts = await listHelmRepoChartsCore(indexUrl);
                return { succeeded: true, result: charts };
            } catch (e2) {
                return { succeeded: false, error: [ "" + e2 ] };
            } finally {
                d.dispose();
            }
        }
        return { succeeded: false, error: [ "" + e ] };
    }
}

async function listHelmRepoChartsCore(indexUrl: string): Promise<HelmRepoChart[]> {
    const buffer: Buffer = await download(indexUrl);
    const yaml = buffer.toString();
    const chartData = YAML.parse(yaml);
    const entries = chartData.entries;
    const charts = Object.keys(entries).map((k) => new HelmRepoChart(k));
    return charts;
}