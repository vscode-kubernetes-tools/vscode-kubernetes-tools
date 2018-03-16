import * as vscode from 'vscode';
import * as shell from 'shelljs';
import * as filepath from 'path';
import { helm as logger } from './logger';
import * as YAML from 'yamljs';
import * as _ from 'lodash';
import * as fs from "fs";
import * as helm from './helm';

export interface PickChartUIOptions {
    readonly warnIfNoCharts : boolean;
}

// This file contains utilities for executing command line tools, notably Helm.

export function helmVersion() {
    helmExec("version -c", (code, out, err) => {
        if (code != 0) {
            vscode.window.showErrorMessage(err);
            return;
        }
        vscode.window.showInformationMessage(out);
    });
}

// Run a 'helm template' command.
// This looks for Chart.yaml files in the present project. If only one is found, it
// runs 'helm template' on it. If multiples are found, it prompts the user to select one.
export function helmTemplate() {
    pickChart((path) => {
        helmExec(`template "${path}"`, (code, out, err) => {
            if (code != 0) {
                vscode.window.showErrorMessage(err);
                return;
            }
            vscode.window.showInformationMessage("chart rendered successfully");
            logger.log(out);
        });
    });
}

export function helmTemplatePreview() {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage("No active editor.");
        return;
    }

    let filePath = editor.document.fileName;
    if (filePath.indexOf("templates") < 0 ) {
        vscode.window.showInformationMessage("Not a template: " +filePath);
        return;
    }

    if (!ensureHelm()) {
        return;
    }

    let u = vscode.Uri.parse(helm.PREVIEW_URI);
    let f = filepath.basename(filePath);
    vscode.commands.executeCommand("vscode.previewHtml", u, vscode.ViewColumn.Two, `Preview ${ f }`);
    helm.recordPreviewHasBeenShown();
}

export function helmDepUp() {
    pickChart((path) => {
        logger.log("⎈⎈⎈ Updating dependencies for " + path);
        helmExec(`dep up "${path}"`, (code, out, err) => {
            logger.log(out);
            logger.log(err);
            if (code != 0) {
                logger.log("⎈⎈⎈ UPDATE FAILED");
            }
        });
    });
}

export function helmCreate() {
    vscode.window.showInputBox({
        prompt: "chart name",
        placeHolder: "mychart"
    }).then((name) => {
        let fullpath = filepath.join(vscode.workspace.rootPath, name);
        helmExec(`create "${fullpath}"`, (code, out, err) => {
            if (code != 0) {
                vscode.window.showErrorMessage(err);
            }
        });
    });
}

// helmLint runs the Helm linter on a chart within your project.
export function helmLint() {
    pickChart((path) => {
        logger.log("⎈⎈⎈ Linting " + path);
        helmExec(`lint "${path}"`, (code, out, err) => {
            logger.log(out);
            logger.log(err);
            if (code != 0) {
                logger.log("⎈⎈⎈ LINTING FAILED");
            }
        });
    });
}

// helmInspect inspects a packaged chart or a chart dir and returns the values.
// If a non-tgz, non-directory file is passed, this tries to find a parent chart.
export function helmInspectValues(u: vscode.Uri) {
    if (!u) {
        vscode.window.showErrorMessage("Helm Inspect Values is primarily for inspecting packaged charts and directories. Launch the command from a file or directory in the Explorer pane.");
        return;
    }
    if (!ensureHelm()) {
        return;
    }
    let uri = vscode.Uri.parse("helm-inspect-values://" + u.fsPath);
    vscode.commands.executeCommand("vscode.previewHtml", uri, vscode.ViewColumn.Two, "Inspect");
}

// helmDryRun runs a helm install with --dry-run and --debug set.
export function helmDryRun() {
    pickChart((path) => {
        logger.log("⎈⎈⎈ Installing (dry-run) " + path);
        helmExec(`install --dry-run --debug "${path}"`, (code, out, err) => {
            logger.log(out);
            logger.log(err);
            if (code != 0) {
                logger.log("⎈⎈⎈ INSTALL FAILED");
            }
        });
    });
}

// pickChart tries to find charts in this repo. If one is found, fn() is executed with that
// chart's path. If more than one are found, the user is prompted to choose one, and then
// the fn is executed with that chart.
//
// callback is fn(path)
export function pickChart(fn) {
    vscode.workspace.findFiles("**/Chart.yaml", "", 1024).then((matches) => {
        switch(matches.length) {
            case 0:
                vscode.window.showErrorMessage("No charts found");
                return;
            case 1:
                // Assume that if there is only one chart, that's the one to run.
                let p = filepath.dirname(matches[0].fsPath);
                fn(p);
                return;
            default:
                let paths = [];
                // TODO: This would be so much cooler if the QuickPick parsed the Chart.yaml
                // and showed the chart name instead of the path.
                matches.forEach((item) => {
                    paths.push(
                        filepath.relative(vscode.workspace.rootPath, filepath.dirname(item.fsPath)) || "."
                    );
                });
                vscode.window.showQuickPick(paths).then((picked) => {
                    fn(filepath.join(vscode.workspace.rootPath, picked));
                });
                return;
        }
    });
}

class Chart {
    public name: string;
    public version: string;
    public appVersion: string;
}

// Load a chart object
export function loadChartMetadata(chartDir: string): Chart {
    let f = filepath.join(chartDir, "Chart.yaml");
    let c;
    try {
        c = YAML.load(f);
    } catch (err) {
        vscode.window.showErrorMessage("Chart.yaml: " + err);
    }
    return c;
}

// Given a file, show any charts that this file belongs to.
export function pickChartForFile(file: string, options: PickChartUIOptions, fn) {
    vscode.workspace.findFiles("**/Chart.yaml", "", 1024).then((matches) => {
        //logger.log(`Found ${ matches.length } charts`)
        switch(matches.length) {
            case 0:
                if (options.warnIfNoCharts) {
                    vscode.window.showErrorMessage("No charts found");
                }
                return;
            case 1:
                // Assume that if there is only one chart, that's the one to run.
                let p = filepath.dirname(matches[0].fsPath);
                fn(p);
                return;
            default:
                let paths = [];

                matches.forEach((item) => {
                    let dirname = filepath.dirname(item.fsPath);
                    let rel = filepath.relative(dirname, file);

                    // If the present file is not in a subdirectory of the parent chart, skip the chart.
                    if (rel.indexOf("..") >= 0) {
                        return;
                    }

                    paths.push(
                        filepath.relative(vscode.workspace.rootPath, filepath.dirname(item.fsPath))
                    );
                });

                if (paths.length == 0) {
                    vscode.window.showErrorMessage("Chart not found for " + file);
                    return;
                }

                // For now, let's go with the top-most path (umbrella chart)
                if (paths.length >= 1) {
                    fn(filepath.join(vscode.workspace.rootPath, paths[0]));
                    return;
                }
                return;
        }
    });
}

// helmExec appends 'args' to a Helm command (helm args...), executes it, and then sends the result to te callback.
// fn should take the signature function(code, stdout, stderr)
//
// This will abort and send an error message if Helm is not installed.
export function helmExec(args: string, fn) {
    if (!ensureHelm()) {
        return;
    }
    let cmd = "helm " + args;
    shell.exec(cmd, fn);
}

export function ensureHelm() {
    if (!shell.which("helm")) {
        vscode.window.showErrorMessage("You must install Helm on your executable path");
        return false;
    }
    return true;
}

export class Requirement {
    public repository: string;
    public name: string;
    public version: string;
    toString(): string {
        return `- name: ${this.name}
  version: ${ this.version }
  repository: ${ this.repository}
`;
    }
}

export function insertRequirement() {
    vscode.window.showInputBox({
        prompt: "Chart",
        placeHolder: "stable/redis",
    }).then((val) => {
        let req = searchForChart(val);
        if (!req) {
            vscode.window.showErrorMessage(`Chart ${ val } not found`);
            return;
        }
        let ed = vscode.window.activeTextEditor;
        if (!ed) {
            logger.log(YAML.stringify(req));
            return;
        }
        ed.insertSnippet(new vscode.SnippetString(req.toString()));
    });
}

// searchForChart takes a 'repo/name' and returns an entry suitable for requirements
export function searchForChart(name: string, version?: string): Requirement {
    let parts = name.split("/", 2);
    if (parts.length != 2) {
        logger.log("Chart should be of the form REPO/CHARTNAME");
        return;
    }
    let hh = helmHome();
    let reposFile = filepath.join(hh, "repository", "repositories.yaml");
    if (!fs.existsSync(reposFile)) {
        vscode.window.showErrorMessage("Helm repositories file " + reposFile + " not found.");
        return;
    }
    let repos = YAML.load(reposFile);
    let req;
    repos.repositories.forEach((repo) => {
        //logger.log("repo: " + repo.name)
        if (repo.name == parts[0]) {
            //let cache = YAML.load(filepath.join(hh, "repository", "cache", repo.cache))
            let cache = YAML.load(repo.cache);
            _.each(cache.entries, (releases, name) => {
                //logger.log("entry: " + name)
                if (name == parts[1]) {
                    req = new Requirement();
                    req.repository = repo.url;
                    req.name = name;
                    req.version = releases[0].version;
                    return;
                }
            });
            return;
        }
    });
    return req;
}

export function helmHome(): string {
    let h = process.env.HOME;
    return process.env["HELM_HOME"] || filepath.join(h, '.helm');
}