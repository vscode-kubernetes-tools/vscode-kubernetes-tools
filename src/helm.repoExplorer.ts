import * as path from 'path';
import * as vscode from 'vscode';
import * as download from 'download';
import * as YAML from 'yamljs';

import { Host } from './host';
import * as helm from './helm.exec';
import { INSPECT_CHART_REPO_AUTHORITY } from './helm';
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
            return [ new HelmError('Unable to list Helm repos', repos.error[0]) ];
        }
        return repos.result;
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }
}

class HelmError implements HelmObject {
    constructor(private readonly text: string, private readonly detail: string) {}

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.text);
        treeItem.tooltip = this.detail;
        return treeItem;
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
        const charts = await listHelmRepoCharts(this.name, this.url);
        if (failed(charts)) {
            return [ new HelmError('Error fetching charts', charts.error[0]) ];
        }
        return charts.result;
    }
}

class HelmRepoChart implements HelmObject {
    private readonly versions: HelmRepoChartVersion[];

    constructor(private readonly repoName, private readonly name: string, private readonly content: any) {
        this.versions = content ? (content as any[]).map((e) => new HelmRepoChartVersion(
            `${this.repoName}/${this.name}`,
            e.version,
            e.appVersion,
            e.description,
            e.sources,
            e.urls)
        ) : [];
    }

    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem(this.name, vscode.TreeItemCollapsibleState.Collapsed);
    }

    async getChildren(): Promise<HelmObject[]> {
        return this.versions;
    }
}

class HelmRepoChartVersion implements HelmObject {
    constructor(
        private readonly id: string,
        private readonly version: string,
        private readonly appVersion: string | undefined,
        private readonly description: string | undefined,
        private readonly sources: string[],
        private readonly urls: string[]
    ) {}

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.version);
        treeItem.tooltip = this.tooltip();
        treeItem.command = {
            command: "extension.helmInspectValues",
            title: "Inspect",
            arguments: [{ kind: INSPECT_CHART_REPO_AUTHORITY, id: this.id, version: this.version }]
        };
        return treeItem;
    }

    async getChildren(): Promise<HelmObject[]> {
        return [];
    }

    private tooltip(): string {
        const tooltipLines: string[] = [ this.description ? this.description : 'No description available'];
        if (this.appVersion) {
            tooltipLines.push(`App version: ${this.appVersion}`);
        }
        return tooltipLines.join('\n');
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

async function listHelmRepoCharts(repoName: string, repoUrl: string): Promise<Errorable<HelmRepoChart[]>> {
    const indexUrl = append(vscode.Uri.parse(repoUrl), 'index.yaml').toString();
    try {
        const charts = await listHelmRepoChartsCore(repoName, indexUrl);
        return { succeeded: true, result: charts };
    } catch (e) {
        if (vscode.Uri.parse(repoUrl).authority.indexOf("127.0.0.1") >= 0) {
            const d = await helm.helmServe();
            try {
                const charts = await listHelmRepoChartsCore(repoName, indexUrl);
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

async function listHelmRepoChartsCore(repoName: string, indexUrl: string): Promise<HelmRepoChart[]> {
    const buffer: Buffer = await download(indexUrl);
    const yaml = buffer.toString();
    const chartData = YAML.parse(yaml);
    const entries = chartData.entries;
    const charts = Object.keys(entries).map((k) => new HelmRepoChart(repoName, k, entries[k]));
    return charts;
}

function append(uri: vscode.Uri, resourceName: string): vscode.Uri {
    const basePath = uri.path;
    const separator = basePath.endsWith('/') ? '' : '/';
    const resourcePath = basePath + separator + resourceName;
    const resourceUri = uri.with({ path: resourcePath });
    return resourceUri;
}