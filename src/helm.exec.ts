import * as vscode from 'vscode';
import * as filepath from 'path';
import { ChildProcess, spawn } from 'child_process';
import { helm as logger } from './logger';
import * as YAML from 'yamljs';
import * as _ from 'lodash';
import * as tmp from 'tmp';
import * as extension from './extension';
import * as explorer from './explorer';
import * as helmrepoexplorer from './helm.repoExplorer';
import * as helm from './helm';
import { showWorkspaceFolderPick } from './hostutils';
import { shell as sh, ShellResult, ExecCallback } from './shell';
import { K8S_RESOURCE_SCHEME, HELM_RESOURCE_AUTHORITY } from './kuberesources.virtualfs';
import { Errorable, failed } from './errorable';
import { parseLineOutput } from './outputUtils';
import { sleep } from './sleep';
import { currentNamespace } from './kubectlUtils';
import { Kubectl } from './kubectl';
import { getToolPath, getUseWsl } from './components/config/config';
import { host } from './host';
import * as fs from './wsl-fs';

export interface PickChartUIOptions {
    readonly warnIfNoCharts: boolean;
}

export enum EnsureMode {
    Alert,
    Silent,
}

// This file contains utilities for executing command line tools, notably Helm.

export function helmVersion() {
    helmExec("version -c", (code, out, err) => {
        if (code !== 0) {
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
            if (code !== 0) {
                vscode.window.showErrorMessage(err);
                return;
            }
            vscode.window.showInformationMessage("chart rendered successfully");
            logger.log(out);
        });
    });
}

export function helmTemplatePreview() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage("No active editor.");
        return;
    }

    const filePath = editor.document.fileName;
    if (filePath.indexOf("templates") < 0 ) {
        vscode.window.showInformationMessage("Not a template: " +filePath);
        return;
    }

    if (!ensureHelm(EnsureMode.Alert)) {
        return;
    }

    const u = vscode.Uri.parse(helm.PREVIEW_URI);
    const f = filepath.basename(filePath);
    vscode.commands.executeCommand("vscode.previewHtml", u, vscode.ViewColumn.Two, `Preview ${ f }`);
    helm.recordPreviewHasBeenShown();
}

export function helmDepUp(arg: any /* Uri | TextDocument | undefined */) {
    if (!arg) {
        pickChart((path) => helmDepUpCore(path));
        return;
    }

    const uri: vscode.Uri = arg.uri || arg;

    if (uri.scheme !== 'file') {
        vscode.window.showErrorMessage('Chart is not on the filesystem');
        return;
    }
    const path = filepath.dirname(uri.fsPath);
    helmDepUpCore(path);
}

function helmDepUpCore(path: string) {
    logger.log("⎈⎈⎈ Updating dependencies for " + path);
    helmExec(`dep up "${path}"`, (code, out, err) => {
        logger.log(out);
        logger.log(err);
        if (code !== 0) {
            logger.log("⎈⎈⎈ UPDATE FAILED");
        }
    });
}

export async function helmCreate(): Promise<void> {
    const createResult = await helmCreateCore("Chart name", "mychart");

    if (createResult && failed(createResult)) {
        vscode.window.showErrorMessage(createResult.error[0]);
    }
}

export async function helmCreateCore(prompt: string, sampleName: string): Promise<Errorable<{ name: string, path: string}> | undefined> {
    const folder = await showWorkspaceFolderPick();
    if (!folder) {
        return undefined;
    }

    const name = await vscode.window.showInputBox({
        prompt: prompt,
        placeHolder: sampleName
    });

    if (!name) {
        return undefined;
    }

    const fullpath = filepath.join(folder.uri.fsPath, name);

    const sr = await helmExecAsync(`create "${fullpath}"`);

    if (sr.code !== 0) {
        return { succeeded: false, error: [ sr.stderr ] };
    }

    return { succeeded: true, result: { name: name, path: fullpath } };
}

// helmLint runs the Helm linter on a chart within your project.
export function helmLint() {
    pickChart((path) => {
        logger.log("⎈⎈⎈ Linting " + path);
        helmExec(`lint "${path}"`, (code, out, err) => {
            logger.log(out);
            logger.log(err);
            if (code !== 0) {
                logger.log("⎈⎈⎈ LINTING FAILED");
            }
        });
    });
}

export function helmInspectValues(arg: any) {
    helmInspect(arg, {
        noTargetMessage: "Helm Inspect Values is for packaged charts and directories. Launch the command from a file or directory in the file explorer. or a chart or version in the Helm Repos explorer.",
        inspectionScheme: helm.INSPECT_VALUES_SCHEME
    });
}

export function helmInspectChart(arg: any) {
    helmInspect(arg, {
        noTargetMessage: "Helm Inspect Chart is for packaged charts and directories. Launch the command from a chart or version in the Helm Repos explorer.",
        inspectionScheme: helm.INSPECT_CHART_SCHEME
    });
}

interface InspectionStrategy {
    readonly noTargetMessage: string;
    readonly inspectionScheme: string;
}

function helmInspect(arg: any, s: InspectionStrategy) {
    if (!arg) {
        vscode.window.showErrorMessage(s.noTargetMessage);
        return;
    }
    if (!ensureHelm(EnsureMode.Alert)) {
        return;
    }

    if (helmrepoexplorer.isHelmRepoChart(arg) || helmrepoexplorer.isHelmRepoChartVersion(arg)) {
        const id = arg.id;
        const versionQuery = helmrepoexplorer.isHelmRepoChartVersion(arg) ? `?${arg.version}` : '';
        const uri = vscode.Uri.parse(`${s.inspectionScheme}://${helm.INSPECT_REPO_AUTHORITY}/${id}${versionQuery}`);
        vscode.commands.executeCommand("vscode.previewHtml", uri, vscode.ViewColumn.Two, "Inspect");
    } else {
        const u = arg as vscode.Uri;
        const uri = vscode.Uri.parse(`${s.inspectionScheme}://${helm.INSPECT_FILE_AUTHORITY}/?${u.fsPath}`);
        vscode.commands.executeCommand("vscode.previewHtml", uri, vscode.ViewColumn.Two, "Inspect");
    }
}

// helmDryRun runs a helm install with --dry-run and --debug set.
export function helmDryRun() {
    pickChart((path) => {
        logger.log("⎈⎈⎈ Installing (dry-run) " + path);
        helmExec(`install --dry-run --debug "${path}"`, (code, out, err) => {
            logger.log(out);
            logger.log(err);
            if (code !== 0) {
                logger.log("⎈⎈⎈ INSTALL FAILED");
            }
        });
    });
}

export function helmGet(resourceNode: explorer.ResourceNode) {
    if (!resourceNode) {
        return;
    }
    const releaseName = resourceNode.id.split(':')[1];
    const uri = helmfsUri(releaseName);
    vscode.workspace.openTextDocument(uri).then((doc) => {
        if (doc) {
            vscode.window.showTextDocument(doc);
        }
    });
}

export function helmfsUri(releaseName: string): vscode.Uri {
    const docname = `helmrelease-${releaseName}.txt`;
    const nonce = new Date().getTime();
    const uri = `${K8S_RESOURCE_SCHEME}://${HELM_RESOURCE_AUTHORITY}/${docname}?value=${releaseName}&_=${nonce}`;
    return vscode.Uri.parse(uri);
}

// helmPackage runs the Helm package on a chart within your project.
export function helmPackage() {
    pickChart((path) => {
        const options = { openLabel: "Save Package", canSelectFiles: false, canSelectFolders: true, canSelectMany: false };
        vscode.window.showOpenDialog(options).then((packagePath) => {
            if (packagePath && packagePath.length === 1) {
                if (packagePath[0].scheme !== 'file') {
                    vscode.window.showErrorMessage('Packaging folder must be a filesystem folder');
                    return;
                }
                logger.log("⎈⎈⎈ Packaging " + path);
                helmExec(`package "${path}" -d "${packagePath[0].fsPath}"`, (code, out, err) => {
                    logger.log(out);
                    logger.log(err);
                    if (code !== 0) {
                        vscode.window.showErrorMessage(err);
                    }
                });
            }
            return;
        });
    });
}

export async function helmFetch(helmObject: helmrepoexplorer.HelmObject | undefined): Promise<void> {
    if (!helmObject) {
        const id = await vscode.window.showInputBox({ prompt: "Chart to fetch", placeHolder: "stable/mychart" });
        if (id) {
            helmFetchCore(id, undefined);
        }
    }
    if (helmrepoexplorer.isHelmRepoChart(helmObject)) {
        await helmFetchCore(helmObject.id, undefined);
    } else if (helmrepoexplorer.isHelmRepoChartVersion(helmObject)) {
        await helmFetchCore(helmObject.id, helmObject.version);
    }
}

async function helmFetchCore(chartId: string, version: string | undefined): Promise<void> {
    const projectFolder = await showWorkspaceFolderPick();
    if (!projectFolder) {
        return;
    }

    const versionArg = version ? `--version ${version}` : '';
    const sr = await helmExecAsync(`fetch ${chartId} --untar ${versionArg} -d "${projectFolder.uri.fsPath}"`);
    if (sr.code !== 0) {
        await vscode.window.showErrorMessage(`Helm fetch failed: ${sr.stderr}`);
        return;
    }
    await vscode.window.showInformationMessage(`Fetched ${chartId}`);
}

export async function helmInstall(kubectl: Kubectl, helmObject: helmrepoexplorer.HelmObject | undefined): Promise<void> {
    if (!helmObject) {
        const id = await vscode.window.showInputBox({ prompt: "Chart to install", placeHolder: "stable/mychart" });
        if (id) {
            helmInstallCore(kubectl, id, undefined);
        }
    }
    if (helmrepoexplorer.isHelmRepoChart(helmObject)) {
        await helmInstallCore(kubectl, helmObject.id, undefined);
    } else if (helmrepoexplorer.isHelmRepoChartVersion(helmObject)) {
        await helmInstallCore(kubectl, helmObject.id, helmObject.version);
    }
}

async function helmInstallCore(kubectl: Kubectl, chartId: string, version: string | undefined): Promise<void> {
    const ns = await currentNamespace(kubectl);
    const nsArg = ns ? `--namespace ${ns}` : '';
    const versionArg = version ? `--version ${version}` : '';
    const sr = await helmExecAsync(`install ${chartId} ${versionArg} ${nsArg}`);
    if (sr.code !== 0) {
        logger.log(sr.stderr);
        await vscode.window.showErrorMessage(`Helm install failed: ${sr.stderr}`);
        return;
    }
    const releaseName = extractReleaseName(sr.stdout);
    logger.log(sr.stdout);
    await vscode.window.showInformationMessage(`Installed ${chartId} as release ${releaseName}`);
}

const HELM_INSTALL_NAME_HEADER = "NAME:";

function extractReleaseName(helmOutput: string): string {
    const lines = helmOutput.split('\n').map((l) => l.trim());
    const nameLine = lines.find((l) => l.startsWith(HELM_INSTALL_NAME_HEADER));
    if (!nameLine) {
        return '(unknown)';
    }
    return nameLine.substring(HELM_INSTALL_NAME_HEADER.length + 1).trim();
}

interface Dependency {
    readonly name: string;
    readonly version: string;
    readonly repository: string;
    readonly status: string;
}

export async function helmDependencies(helmObject: helmrepoexplorer.HelmObject | undefined): Promise<void> {
    if (!helmObject) {
        const id = await vscode.window.showInputBox({ prompt: "Chart to show dependencies for", placeHolder: "stable/mychart" });
        if (id) {
            helmDependenciesLaunchViewer(id, undefined);
        }
    }
    if (helmrepoexplorer.isHelmRepoChart(helmObject)) {
        await helmDependenciesLaunchViewer(helmObject.id, undefined);
    } else if (helmrepoexplorer.isHelmRepoChartVersion(helmObject)) {
        await helmDependenciesLaunchViewer(helmObject.id, helmObject.version);
    }
}

async function helmDependenciesLaunchViewer(chartId: string, version: string | undefined): Promise<void> {
    // Boing it back through a HTML preview window
    const versionQuery = version ? `?${version}` : '';
    const uri = vscode.Uri.parse(`${helm.DEPENDENCIES_SCHEME}://${helm.DEPENDENCIES_REPO_AUTHORITY}/${chartId}${versionQuery}`);
    await vscode.commands.executeCommand("vscode.previewHtml", uri, vscode.ViewColumn.Two, `${chartId} Dependencies`);
}

export async function helmDependenciesCore(chartId: string, version: string | undefined): Promise<Errorable<{ [key: string]: string }[]>> {
    const tempDirObj = tmp.dirSync({ prefix: "vsk-fetchfordeps-", unsafeCleanup: true });
    const versionArg = version ? `--version ${version}` : '';
    const fsr = await helmExecAsync(`fetch ${chartId} ${versionArg} -d "${tempDirObj.name}"`);
    if (fsr.code !== 0) {
        tempDirObj.removeCallback();
        return { succeeded: false, error: [`Helm fetch failed: ${fsr.stderr}`] };
    }

    const tempDirFiles = sh.ls(tempDirObj.name);
    const chartPath = filepath.join(tempDirObj.name, tempDirFiles[0]);  // should be the only thing in the directory
    try {
        const dsr = await helmExecAsync(`dep list "${chartPath}"`);
        if (dsr.code !== 0) {
            return { succeeded: false, error: [`Helm dependency list failed: ${dsr.stderr}`] };
        }
        const lines = dsr.stdout.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length === 1) {
            return { succeeded: false, error: [`${chartId} has no dependencies`] };  // I don't feel good about using an error for this but life is short
        }
        const dependencies = parseLineOutput(lines, helm.HELM_OUTPUT_COLUMN_SEPARATOR);
        return { succeeded: true, result: dependencies };
    } finally {
        fs.unlinkSync(chartPath);
        tempDirObj.removeCallback();
    }
}

// pickChart tries to find charts in this repo. If one is found, fn() is executed with that
// chart's path. If more than one are found, the user is prompted to choose one, and then
// the fn is executed with that chart.
//
// callback is fn(path)
export function pickChart(fn: (chartPath: string) => void) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("This command requires an open folder.");
        return;
    }
    vscode.workspace.findFiles("**/Chart.yaml", "", 1024).then((matches) => {
        switch (matches.length) {
            case 0:
                vscode.window.showErrorMessage("No charts found");
                return;
            case 1:
                // Assume that if there is only one chart, that's the one to run.
                const p = filepath.dirname(matches[0].fsPath);
                fn(p);
                return;
            default:
                const paths = [];
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
    const f = filepath.join(chartDir, "Chart.yaml");
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
        switch (matches.length) {
            case 0:
                if (options.warnIfNoCharts) {
                    vscode.window.showErrorMessage("No charts found");
                }
                return;
            case 1:
                // Assume that if there is only one chart, that's the one to run.
                const p = filepath.dirname(matches[0].fsPath);
                fn(p);
                return;
            default:
                const paths = [];

                matches.forEach((item) => {
                    const dirname = filepath.dirname(item.fsPath);
                    const rel = filepath.relative(dirname, file);

                    // If the present file is not in a subdirectory of the parent chart, skip the chart.
                    if (rel.indexOf("..") >= 0) {
                        return;
                    }

                    paths.push(
                        filepath.relative(vscode.workspace.rootPath, filepath.dirname(item.fsPath))
                    );
                });

                if (paths.length === 0) {
                    if (options.warnIfNoCharts) {
                        vscode.window.showErrorMessage("Chart not found for " + file);
                    }
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

export function helmExec(args: string, fn: ExecCallback) {
    if (!ensureHelm(EnsureMode.Alert)) {
        return;
    }
    const configuredBin: string | undefined = getToolPath(host, sh, 'helm');
    const bin = configuredBin ? `"${configuredBin}"` : "helm";
    const cmd = `${bin} ${args}`;
    const promise = sh.exec(cmd);
    promise.then((res: ShellResult) => {
        fn(res.code, res.stdout, res.stderr);
    }, (err) => {
        console.log(`exec failed! (${err})`);
    });
}

export async function helmExecAsync(args: string): Promise<ShellResult> {
    // TODO: deduplicate with helmExec
    if (!ensureHelm(EnsureMode.Alert)) {
        return { code: -1, stdout: "", stderr: "" };
    }
    const configuredBin: string | undefined = getToolPath(host, sh, 'helm');
    const bin = configuredBin ? `"${configuredBin}"` : "helm";
    const cmd = `${bin} ${args}`;
    return await sh.exec(cmd);
}

const HELM_PAGING_PREFIX = "next:";

export async function helmListAll(namespace?: string): Promise<Errorable<{ [key: string]: string }[]>> {
    if (!ensureHelm(EnsureMode.Alert)) {
        return { succeeded: false, error: [ "Helm client is not installed" ] };
    }

    const releases: {[key: string]: string}[] = [];
    let offset: string | null = null;

    do {
        const nsarg = namespace ? `--namespace ${namespace}` : "";
        const offsetarg = offset ? `--offset ${offset}` : "";
        const sr = await helmExecAsync(`list --max 0 ${nsarg} ${offsetarg}`);

        if (sr.code !== 0) {
            return { succeeded: false, error: [ sr.stderr ] };
        }

        const lines = sr.stdout.split('\n')
                               .map((s) => s.trim())
                               .filter((l) => l.length > 0);
        if (lines.length > 0) {
            if (lines[0].startsWith(HELM_PAGING_PREFIX)) {
                const pagingInfo = lines.shift();
                offset = pagingInfo.substring(HELM_PAGING_PREFIX.length).trim();
            } else {
                offset = null;
            }
        }
        if (lines.length > 0) {
            const helmReleases = parseLineOutput(lines, helm.HELM_OUTPUT_COLUMN_SEPARATOR);
            releases.push(...helmReleases);
        }
    } while (offset !== null);

    return { succeeded: true, result: releases };
}

export function ensureHelm(mode: EnsureMode) {
    const configuredBin: string | undefined = getToolPath(host, sh, 'helm');
    if (configuredBin) {
        if (fs.existsSync(configuredBin)) {
            return true;
        }
        if (mode === EnsureMode.Alert) {
            vscode.window.showErrorMessage(`${configuredBin} does not exist!`, "Install dependencies").then((str) =>
            {
                if (str === "Install dependencies") {
                    extension.installDependencies();
                }
            });
        }
        return false;
    }
    if (sh.which("helm")) {
        return true;
    }
    if (mode === EnsureMode.Alert) {
        vscode.window.showErrorMessage(`Could not find Helm binary.`, "Install dependencies").then((str) =>
        {
            if (str === "Install dependencies") {
                extension.installDependencies();
            }
        });
    }
    return false;
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
        const req = searchForChart(val);
        if (!req) {
            vscode.window.showErrorMessage(`Chart ${ val } not found`);
            return;
        }
        const ed = vscode.window.activeTextEditor;
        if (!ed) {
            logger.log(YAML.stringify(req));
            return;
        }
        ed.insertSnippet(new vscode.SnippetString(req.toString()));
    });
}

// searchForChart takes a 'repo/name' and returns an entry suitable for requirements
export function searchForChart(name: string, version?: string): Requirement {
    const parts = name.split("/", 2);
    if (parts.length !== 2) {
        logger.log("Chart should be of the form REPO/CHARTNAME");
        return;
    }
    const hh = helmHome();
    const reposFile = filepath.join(hh, "repository", "repositories.yaml");
    if (!fs.existsSync(reposFile)) {
        vscode.window.showErrorMessage(`Helm repositories file ${reposFile} not found.`);
        return;
    }
    const repos = YAML.load(reposFile);
    let req;
    repos.repositories.forEach((repo) => {
        if (repo.name === parts[0]) {
            const cache = YAML.load(repo.cache);
            _.each(cache.entries, (releases, name) => {
                if (name === parts[1]) {
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
    const h = sh.home();
    return process.env["HELM_HOME"] || filepath.join(h, '.helm');
}

export async function helmServe(): Promise<vscode.Disposable> {
    const configuredBin: string | undefined = getToolPath(host, sh, 'helm');
    const bin = sh.unquotedPath(configuredBin ? `"${configuredBin}"` : "helm");
    const process = spawn(bin, [ "serve" ]);
    let ready = false;
    process.stdout.on("data", (chunk: string) => {  // TODO: this huge sausage is VERY suspicious
        if (chunk.indexOf("serving") >= 0) {
            ready = true;
        }
    });
    while (!ready) {
        await sleep(100);
    }
    return new vscode.Disposable(() => { process.kill(); });
}
