import * as path from 'path';
import * as vscode from 'vscode';
import * as _ from 'lodash';

import { Host } from './host';
import * as helm from './helm.exec';
import { HELM_OUTPUT_COLUMN_SEPARATOR } from './helm';
import { Errorable, failed } from './errorable';
import { parseLineOutput } from './outputUtils';
import { affectsUs } from './components/config/config';

export function create(host: Host): HelmRepoExplorer {
    return new HelmRepoExplorer(host);
}

export enum RepoExplorerObjectKind {
    Repo,
    Chart,
    ChartVersion,
    Error,
}

export interface HelmObject {
    readonly kind: RepoExplorerObjectKind;
    getChildren(): Promise<HelmObject[]>;
    getTreeItem(): vscode.TreeItem;
}

export interface HelmRepo extends HelmObject {
    readonly name: string;
}

export interface HelmRepoChart extends HelmObject {
    readonly id: string;
}

export interface HelmRepoChartVersion extends HelmObject {
    readonly id: string;
    readonly version: string;
}

export function isHelmRepo(o: HelmObject): o is HelmRepo {
    return o && o.kind === RepoExplorerObjectKind.Repo;
}

export function isHelmRepoChart(o: HelmObject): o is HelmRepoChart {
    return o && o.kind === RepoExplorerObjectKind.Chart;
}

export function isHelmRepoChartVersion(o: HelmObject): o is HelmRepoChartVersion {
    return o && o.kind === RepoExplorerObjectKind.ChartVersion;
}

export class HelmRepoExplorer implements vscode.TreeDataProvider<HelmObject> {
    private onDidChangeTreeDataEmitter: vscode.EventEmitter<HelmObject | undefined> = new vscode.EventEmitter<HelmObject | undefined>();
    readonly onDidChangeTreeData: vscode.Event<HelmObject | undefined> = this.onDidChangeTreeDataEmitter.event;

    constructor(private readonly host: Host) {
        host.onDidChangeConfiguration((change) => {
            if (affectsUs(change)) {
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

    async refresh(): Promise<void> {
        await helm.helmExecAsync('repo update');
        this.onDidChangeTreeDataEmitter.fire();
    }
}

class HelmError implements HelmObject {
    constructor(private readonly text: string, private readonly detail: string) {}

    get kind() { return RepoExplorerObjectKind.Error; }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.text);
        treeItem.tooltip = this.detail;
        return treeItem;
    }

    async getChildren(): Promise<HelmObject[]> {
        return [];
    }
}

class HelmRepoImpl implements HelmRepo {
    constructor(readonly name: string, private readonly url: string) {}

    get kind() { return RepoExplorerObjectKind.Repo; }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.name, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.iconPath = {
            light: vscode.Uri.file(path.join(__dirname, "../../images/light/helm-blue-vector.svg")),
            dark: vscode.Uri.file(path.join(__dirname, "../../images/dark/helm-white-vector.svg")),
        };
        treeItem.contextValue = 'vsKubernetes.repo';
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

class HelmRepoChartImpl implements HelmRepoChart {
    private readonly versions: HelmRepoChartVersionImpl[];
    private readonly name: string;

    constructor(repoName: string, readonly id: string, content: { [key: string]: string }[]) {
        this.versions = content.map((e) => new HelmRepoChartVersionImpl(
            id,
            e['chart version'],
            e['app version'],
            e.description
        ));
        this.name = id.substring(repoName.length + 1);
    }

    get kind() { return RepoExplorerObjectKind.Chart; }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.name, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = 'vsKubernetes.chart';
        return treeItem;
    }

    async getChildren(): Promise<HelmObject[]> {
        return this.versions;
    }
}

class HelmRepoChartVersionImpl implements HelmRepoChartVersion {
    constructor(
        readonly id: string,
        readonly version: string,
        private readonly appVersion: string | undefined,
        private readonly description: string | undefined
    ) {}

    get kind() { return RepoExplorerObjectKind.ChartVersion; }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.version);
        treeItem.tooltip = this.tooltip();
        treeItem.command = {
            command: "extension.helmInspectChart",
            title: "Inspect",
            arguments: [this]
        };
        treeItem.contextValue = 'vsKubernetes.chartversion';
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

async function listHelmRepos(): Promise<Errorable<HelmRepoImpl[]>> {
    const sr = await helm.helmExecAsync("repo list");
    // TODO: prompt to run 'helm init' here if needed...
    if (sr.code !== 0) {
        return { succeeded: false, error: [sr.stderr] };
    }

    const repos = sr.stdout.split('\n')
                           .slice(1)
                           .map((l) => l.trim())
                           .filter((l) => l.length > 0)
                           .map((l) => l.split('\t').map((bit) => bit.trim()))
                           .map((bits) => new HelmRepoImpl(bits[0], bits[1]));
    return { succeeded: true, result: repos };
}

async function listHelmRepoCharts(repoName: string, repoUrl: string): Promise<Errorable<HelmRepoChartImpl[]>> {
    const sr = await helm.helmExecAsync(`search ${repoName}/ -l`);
    if (sr.code !== 0) {
        return { succeeded: false, error: [ sr.stderr ]};
    }

    const lines = sr.stdout.split('\n')
                           .map((l) => l.trim())
                           .filter((l) => l.length > 0);
    const entries = parseLineOutput(lines, HELM_OUTPUT_COLUMN_SEPARATOR);
    const charts = _.chain(entries)
                    .groupBy((e) => e.name)
                    .toPairs()
                    .map((p) => new HelmRepoChartImpl(repoName, p[0], p[1]))
                    .value();
    return { succeeded: true, result: charts };
}
