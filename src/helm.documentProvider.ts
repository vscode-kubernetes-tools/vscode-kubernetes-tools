import * as filepath from 'path';
import * as vscode from 'vscode';
import * as YAML from 'yamljs';
import { escape as htmlEscape } from 'lodash';

import {
    helmInspectArgs,
    helmTemplatePreviewArgs,
    parseHelmChartQuery,
    parseHelmFileQuery,
    parseHelmRepositoryChartQuery,
} from './components/helm/commands';
import { helmPathForExecution, helmRelativePathForExecution } from './components/helm/executable';
import * as exec from './helm.exec';
import * as helm from './helm';
import * as logger from './logger';
import { getUseWsl } from './components/config/config';
import { failed } from './errorable';
import * as fs from 'fs';

interface HelmDocumentResult {
    readonly title: string;
    readonly subtitle?: string;
    readonly content: string;
    readonly isErrorOutput: boolean;
}

function htmlTag(tag: string, content: string): string {
    const htmlContent = htmlEscape(content);
    return `<${tag}>${htmlContent}</${tag}>`;
}

function render(document: HelmDocumentResult): string {
    const subtitle = document.subtitle ? htmlTag('h2', document.subtitle) : '';
    const bodyContent = htmlTag('pre', document.content);
    return `<body>
      <style>
        pre { white-space: pre-wrap; word-wrap: break-word; }
      </style>
      ${htmlTag('h1', document.title)}
      ${subtitle}
      ${bodyContent}
    </body>`;
}

export class HelmInspectDocumentProvider implements vscode.TextDocumentContentProvider {
    public async provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken): Promise<string> {
        if (uri.scheme !== helm.INSPECT_CHART_SCHEME) {
            throw new Error('Invalid Helm chart URI.');
        }

        if (uri.authority === helm.INSPECT_FILE_AUTHORITY) {
            const file = parseHelmFileQuery(uri.query);
            if (!file) {
                throw new Error('Invalid Helm chart URI.');
            }
            return this.inspectLocalChart(file);
        }

        if (uri.authority === helm.INSPECT_REPO_AUTHORITY) {
            const request = parseHelmRepositoryChartQuery(uri.query);
            if (!request) {
                throw new Error('Invalid Helm chart URI.');
            }
            const syntaxVersion = await exec.helmSyntaxVersion();
            const chart = await helmPathForExecution(request.chart, getUseWsl());
            return this.runInspect(
                helmInspectArgs(syntaxVersion, 'chart', chart, request.version),
                `Inspect ${request.chart}${request.version ? ` ${request.version}` : ''}`,
                true
            );
        }

        throw new Error('Invalid Helm chart URI.');
    }

    private async inspectLocalChart(file: string): Promise<string> {
        const fileInfo = fs.statSync(file);
        if ((!fileInfo.isDirectory() && filepath.extname(file) === '.tgz') ||
            (fileInfo.isDirectory() && fs.existsSync(filepath.join(file, 'Chart.yaml')))) {
            return this.inspectLocalPath(file);
        }
        const chartPath = await exec.pickChartForFileAsync(file, { warnIfNoCharts: true });
        if (!chartPath) {
            throw new Error(`No Helm chart found for ${file}.`);
        }
        return this.inspectLocalPath(chartPath);
    }

    private async inspectLocalPath(chartPath: string): Promise<string> {
        const syntaxVersion = await exec.helmSyntaxVersion();
        const executionPath = await helmPathForExecution(chartPath, getUseWsl());
        return this.runInspect(
            helmInspectArgs(syntaxVersion, 'chart', executionPath),
            `Inspect ${filepath.basename(chartPath) || 'Chart'}`,
            false
        );
    }

    private async runInspect(args: readonly string[], title: string, repositoryChart: boolean): Promise<string> {
        const result = repositoryChart ?
            await exec.helmExecRepositoryArgsAsync(args) :
            await exec.helmExecArgsAsync(args);
        if (!result || result.code !== 0) {
            const message = result ? result.stderr || result.stdout : 'Unable to run Helm';
            console.log(`Inspect failed: ${message}`);
            vscode.window.showErrorMessage(`Helm inspect failed: ${message}`);
            throw new Error(message);
        }
        return render({ title, content: result.stdout, isErrorOutput: false });
    }
}

export class HelmValuesDocumentProvider implements vscode.TextDocumentContentProvider {
    public async provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken): Promise<string> {
        if (uri.scheme !== helm.FETCH_VALUES_SCHEME) {
            throw new Error('Invalid Helm values URI.');
        }
        if (uri.authority === helm.INSPECT_FILE_AUTHORITY) {
            const file = parseHelmFileQuery(uri.query);
            if (!file) {
                throw new Error('Invalid Helm values URI.');
            }
            const target = await this.localChartPath(file);
            const syntaxVersion = await exec.helmSyntaxVersion();
            return this.inspectValues(syntaxVersion, target);
        }
        if (uri.authority !== helm.INSPECT_REPO_AUTHORITY) {
            throw new Error('Invalid Helm values URI.');
        }
        const request = parseHelmRepositoryChartQuery(uri.query);
        if (!request) {
            throw new Error('Invalid Helm values URI.');
        }
        const syntaxVersion = await exec.helmSyntaxVersion();
        const chart = await helmPathForExecution(request.chart, getUseWsl());
        const result = await exec.helmExecRepositoryArgsAsync(
            helmInspectArgs(syntaxVersion, 'values', chart, request.version)
        );
        if (!result || result.code !== 0) {
            const message = result ? result.stderr || result.stdout : 'Unable to run Helm';
            console.log(`failed to inspect values: ${message}`);
            throw new Error(message);
        }
        return result.stdout;
    }

    private async localChartPath(file: string): Promise<string> {
        const fileInfo = fs.statSync(file);
        if ((!fileInfo.isDirectory() && filepath.extname(file) === '.tgz') ||
            (fileInfo.isDirectory() && fs.existsSync(filepath.join(file, 'Chart.yaml')))) {
            return file;
        }
        const chartPath = await exec.pickChartForFileAsync(file, { warnIfNoCharts: true });
        if (!chartPath) {
            throw new Error(`No Helm chart found for ${file}.`);
        }
        return chartPath;
    }

    private async inspectValues(syntaxVersion: exec.HelmSyntaxVersion, chartPath: string): Promise<string> {
        const executionPath = await helmPathForExecution(chartPath, getUseWsl());
        const result = await exec.helmExecArgsAsync(helmInspectArgs(syntaxVersion, 'values', executionPath));
        if (!result || result.code !== 0) {
            throw new Error(result ? result.stderr || result.stdout : 'Unable to run Helm');
        }
        return result.stdout;
    }
}

export class HelmTemplatePreviewDocumentProvider implements vscode.TextDocumentContentProvider {
    private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this.onDidChangeEmitter.event;
    }

    public update(uri: vscode.Uri) {
        this.onDidChangeEmitter.fire(uri);
    }

    public async provideTextDocumentContent(_uri: vscode.Uri, _token: vscode.CancellationToken): Promise<string> {
        if (!vscode.window.activeTextEditor) {
            logger.helm.log('FIXME: no editor selected');
            return render({ title: 'Chart Preview', content: 'No editor selected', isErrorOutput: true });
        }
        const templatePath = vscode.window.activeTextEditor.document.fileName;
        const syntaxVersion = await exec.helmSyntaxVersion();
        let chartPath = await exec.pickChartForFileAsync(templatePath, { warnIfNoCharts: true });
        if (!chartPath) {
            return render({ title: 'Chart Preview', content: 'No chart found', isErrorOutput: true });
        }
        if (!fs.statSync(chartPath).isDirectory()) {
            chartPath = filepath.dirname(chartPath);
        }
        const relativeTemplatePath = filepath.relative(chartPath, templatePath);
        const executionChartPath = await helmPathForExecution(chartPath, getUseWsl());
        const executionTemplatePath = helmRelativePathForExecution(relativeTemplatePath, getUseWsl());
        const result = await exec.helmExecArgsAsync(
            helmTemplatePreviewArgs(syntaxVersion, executionChartPath, executionTemplatePath)
        );
        if (!result || result.code !== 0) {
            return render({
                title: 'Chart Preview',
                subtitle: 'Failed template call',
                content: result ? result.stderr : 'Unable to run Helm',
                isErrorOutput: true,
            });
        }

        if (filepath.basename(relativeTemplatePath) !== 'NOTES.txt') {
            try {
                YAML.parse(result.stdout);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`YAML failed to parse: ${errorMessage}`);
            }
        }

        return render({
            title: relativeTemplatePath,
            content: result.stdout || 'Helm template produced no output',
            isErrorOutput: result.stdout.length === 0,
        });
    }
}

export class HelmDependencyDocumentProvider implements vscode.TextDocumentContentProvider {
    public provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<string> {
        return this.provideTextDocumentContentImpl(uri);
    }

    async provideTextDocumentContentImpl(uri: vscode.Uri): Promise<string> {
        if (uri.scheme !== helm.DEPENDENCIES_SCHEME || uri.authority !== helm.DEPENDENCIES_REPO_AUTHORITY) {
            return htmlTag('p', 'Invalid Helm dependencies URI.');
        }
        const request = parseHelmChartQuery(uri.query);
        if (!request) {
            return htmlTag('p', 'Invalid Helm dependencies URI.');
        }
        const dependencies = await exec.helmDependenciesCore(request.chart, request.version);
        if (failed(dependencies)) {
            return htmlTag('p', dependencies.error[0]);
        }

        const list = dependencies.result.map(this.formatDependency).join('');
        return `${htmlTag('p', `${request.chart} depends on:`)}<ul>${list}</ul>`;
    }

    formatDependency(dependency: { [key: string]: string }): string {
        const name = dependency.name || '';
        const version = dependency.version === '*' ? '' : ` (v${dependency.version || ''})`;
        const repository = dependency.repository || '';
        const repoPrefix = repository.startsWith('alias:') ? `${repository.substring('alias:'.length)}/` : '';
        const repoSuffix = repository.startsWith('alias:') ? '' : ` from ${repository}`;
        const status = ` - ${dependency.status || ''}`;
        return htmlTag('li', `${repoPrefix}${name}${version}${repoSuffix}${status}`);
    }
}
