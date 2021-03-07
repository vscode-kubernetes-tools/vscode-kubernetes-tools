import * as vscode from "vscode";
import * as filepath from "path";
import * as exec from "./helm.exec";
import * as YAML from "yamljs";
import * as fs from "./wsl-fs";
import { escape as htmlEscape } from "lodash";
import * as querystring from "querystring";

import * as helm from "./helm";
import * as logger from "./logger";
import { failed } from "./errorable";
import * as shell from "./shell";

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
    const bodyTag = document.isErrorOutput ? 'p' : 'pre';
    const bodyContent = htmlTag(bodyTag, document.content);
    return `<body>
      <h1>${document.title}</h1>
      ${subtitle}
      ${bodyContent}
    </body>`;
}

function extractChartName(uri: vscode.Uri): string {
    if (uri.authority === helm.INSPECT_REPO_AUTHORITY) {
        const id = uri.path.substring(1);
        const version = uri.query;
        return `${id} ${version}`;
    }
    if (uri.authority === helm.INSPECT_FILE_AUTHORITY) {
        const fsPath = uri.query;
        if (filepath.extname(fsPath) === ".tgz") {
            return filepath.basename(fsPath);
        }
    }
    return "Chart";
}

export class HelmInspectDocumentProvider implements vscode.TextDocumentContentProvider {
    public provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<string> {
        return new Promise<string>((resolve, reject) => {
            const printer = (code: number, out: string, err: string) => {
                if (code === 0) {
                    const p = extractChartName(uri);
                    const title = "Inspect " + p;
                    resolve(render({ title: title, content: out, isErrorOutput: false }));
                    return;
                }
                console.log(`Inspect failed: ${out} ${err}`);
                reject(err);
            };
            const filePrinter = (code: number, out: string, err: string) => {
                if (code === 0) {
                    resolve(out);
                    return;
                }
                console.log(`failed to generate values.yaml: ${out} ${err}`);
                reject(err);
            };

            if (uri.authority === helm.INSPECT_FILE_AUTHORITY) {
                // currently always INSPECT_VALUES_SCHEME
                const file = uri.query;
                const fi = fs.statSync(file);
                if (!fi.isDirectory() && filepath.extname(file) === ".tgz") {
                    exec.helmExec(`inspect values "${file}"`, printer);
                    return;
                } else if (fi.isDirectory() && fs.existsSync(filepath.join(file, "Chart.yaml"))) {
                    exec.helmExec(`inspect values "${file}"`, printer);
                    return;
                }
                exec.pickChartForFile(file, { warnIfNoCharts: true }, (path) => {
                    exec.helmExec(`inspect values "${path}"`, printer);
                });
            } else if (uri.authority === helm.INSPECT_REPO_AUTHORITY) {
                const id = uri.path.substring(1);
                const query = querystring.parse(uri.query);
                const version = query.version as string;
                const generateFile = (query.generateFile as string) ? true : false;
                if (!shell.isSafe(id)) {
                    vscode.window.showWarningMessage(`Unexpected characters in chart name ${id}. Use Helm CLI to inspect this chart.`);
                    return;
                }
                if (version && !shell.isSafe(version)) {
                    vscode.window.showWarningMessage(`Unexpected characters in chart version ${version}. Use Helm CLI to inspect this chart.`);
                    return;
                }

                const versionArg = version ? `--version ${version}` : '';
                exec.helmSyntaxVersion().then((sv) => {
                    const helm3Scope = (sv === exec.HelmSyntaxVersion.V2) ? '' : 'all';
                    if (uri.scheme === helm.INSPECT_CHART_SCHEME) {
                        exec.helmExec(`inspect ${helm3Scope} ${id} ${versionArg}`, printer);
                    } else if (uri.scheme === helm.INSPECT_VALUES_SCHEME) {
                        if (generateFile) {
                            exec.helmExec(`inspect values ${id} ${versionArg}`, filePrinter);
                        } else {
                            exec.helmExec(`inspect values ${id} ${versionArg}`, printer);
                        }
                    }
                });
            }
        });

    }
}

export class HelmValuesDocumentProvider implements vscode.TextDocumentContentProvider {
    public provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<string> {
        return new Promise<string>((resolve, reject) => {
            const filePrinter = (code: number, out: string, err: string) => {
                if (code === 0) {
                    resolve(out);
                    return;
                }
                console.log(`failed to generate values.yaml: ${out} ${err}`);
                reject(err);
            };
            if (
                uri.authority === helm.INSPECT_REPO_AUTHORITY &&
                uri.scheme === helm.GET_VALUES_SCHEME
            ) {
                const query = querystring.parse(uri.query);
                const id = query.chart as string;
                const version = query.version as string;
                if (!shell.isSafe(id)) {
                    vscode.window.showWarningMessage(`Unexpected characters in chart name ${id}. Use Helm CLI to inspect this chart.`);
                    return;
                }
                if (version && !shell.isSafe(version)) {
                    vscode.window.showWarningMessage(`Unexpected characters in chart version ${version}. Use Helm CLI to inspect this chart.`);
                    return;
                }
                const versionArg = version ? `--version ${version}` : "";
                exec.helmExec(`inspect values ${id} ${versionArg}`, filePrinter);
            }
        });
    }
}

// Provide an HTML-formatted preview window.
export class HelmTemplatePreviewDocumentProvider implements vscode.TextDocumentContentProvider {
    private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this.onDidChangeEmitter.event;
    }

    public update(uri: vscode.Uri) {
        this.onDidChangeEmitter.fire(uri);
	}

    public provideTextDocumentContent(_uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<string> {
        return new Promise<string>((resolve) => {
            // The URI is the encapsulated path to the template to render.
            if (!vscode.window.activeTextEditor) {
                logger.helm.log("FIXME: no editor selected");
                return;
            }
            const tpl = vscode.window.activeTextEditor.document.fileName;

            exec.helmSyntaxVersion().then((v) => {

                // First, we need to get the top-most chart:
                exec.pickChartForFile(tpl, { warnIfNoCharts: true }, (chartPath) => {
                    // We need the relative path for 'helm template'
                    if (!fs.statSync(chartPath).isDirectory()) {
                        chartPath = filepath.dirname(chartPath);
                    }
                    const reltpl = filepath.relative(chartPath, tpl);
                    const notesarg = (tpl.toLowerCase().endsWith('notes.txt')) ? '--notes' : '';
                    const displayResultAfterCommandExecution = (code: number, out: string, err: any) => {
                        if (code !== 0) {
                            const errorDoc = { title: "Chart Preview", subtitle: "Failed template call", content: err, isErrorOutput: true };
                            resolve(render(errorDoc));
                            return;
                        }

                        if (filepath.basename(reltpl) !== "NOTES.txt") {
                            try {
                                YAML.parse(out);
                            } catch (e) {
                                // TODO: Figure out the best way to display this message, but have it go away when the
                                // file parses correctly.
                                vscode.window.showErrorMessage(`YAML failed to parse: ${ e.message }`);
                            }
                        }

                        const previewDoc = out ?
                            { title: reltpl, content: out, isErrorOutput: false } :
                            { title: reltpl, content: 'Helm template produced no output', isErrorOutput: true };
                        resolve(render(previewDoc));
                    };

                    if (v === exec.HelmSyntaxVersion.V3) {
                        exec.helmExec(`template "${chartPath}" --show-only "${reltpl}" ${notesarg}`, displayResultAfterCommandExecution);
                    } else {
                        exec.helmExec(`template "${chartPath}" --execute "${reltpl}" ${notesarg}`, displayResultAfterCommandExecution);
                    }
                });
            });
        });

    }
}

export class HelmDependencyDocumentProvider implements vscode.TextDocumentContentProvider {
    public provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<string> {
        return this.provideTextDocumentContentImpl(uri);
    }

    async provideTextDocumentContentImpl(uri: vscode.Uri): Promise<string> {
        const chartId = uri.path.substring(1);
        const version = uri.query;
        const dependencies = await exec.helmDependenciesCore(chartId, version);
        if (failed(dependencies)) {
            return `<p>${dependencies.error[0]}</p>`;
        }

        const list =  dependencies.result
                                  .map(this.formatDependency)
                                  .join('<br>');
        return `<p>${chartId} depends on:</p><ul>${list}</ul>`;
    }

    formatDependency(d: { [key: string]: string }): string {
        const name = d.name;
        const version = d.version === '*' ? '' : ` (v${d.version})`;
        const repoPrefix = d.repository.startsWith('alias:') ? d.repository.substring('alias:'.length) + '/' : '';
        const repoSuffix = d.repository.startsWith('alias:') ? '' : ` from ${d.repository}`;
        const status = ` - ${d.status}`;
        return `<li>${repoPrefix}${name}${version}${repoSuffix}${status}</li>`;
    }
}
