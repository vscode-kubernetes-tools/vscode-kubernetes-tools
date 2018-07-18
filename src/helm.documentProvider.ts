import * as vscode from 'vscode';
import * as filepath from 'path';
import * as exec from './helm.exec';
import * as YAML from 'yamljs';
import * as fs from 'fs';
import { escape as htmlEscape } from 'lodash';

import * as helm from './helm';
import * as logger from './logger';

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

export class HelmInspectDocumentProvider implements vscode.TextDocumentContentProvider {
    public provideTextDocumentContent(uri: vscode.Uri, tok: vscode.CancellationToken): vscode.ProviderResult<string> {
        return new Promise<string>((resolve, reject) => {
            console.log("provideTextDocumentContent called with uri " + uri.toString());

            const printer = (code, out, err) => {
                if (code === 0) {
                    const p = (filepath.extname(uri.fsPath) === ".tgz") ? filepath.basename(uri.fsPath) : "Chart";
                    const title = "Inspect " + p;
                    resolve(render({ title: title, content: out, isErrorOutput: false }));
                }
                reject(err);
            };

            if (uri.scheme === helm.INSPECT_SCHEME) {
                const file = uri.fsPath || uri.authority;
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
            } else if (uri.scheme === helm.INSPECT_CHART_SCHEME && uri.authority === helm.INSPECT_CHART_REPO_AUTHORITY) {
                const id = uri.path.substring(1);
                const version = uri.query;
                exec.helmExec(`inspect ${id} --version ${version}`, printer);
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

    public provideTextDocumentContent(uri: vscode.Uri, tok: vscode.CancellationToken): vscode.ProviderResult<string> {
        return new Promise<string>((resolve, reject) => {
            // The URI is the encapsulated path to the template to render.
            if (!vscode.window.activeTextEditor) {
                logger.helm.log("FIXME: no editor selected");
                return;
            }
            const tpl = vscode.window.activeTextEditor.document.fileName;

            // First, we need to get the top-most chart:
            exec.pickChartForFile(tpl, { warnIfNoCharts: true }, (chartPath) => {
                // We need the relative path for 'helm template'
                if (!fs.statSync(chartPath).isDirectory) {
                    chartPath = filepath.dirname(chartPath);
                }
                const reltpl = filepath.relative(chartPath, tpl);
                exec.helmExec(`template "${chartPath}" --execute "${reltpl}"`, (code, out, err) => {
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
                });
            });
        });

    }
}