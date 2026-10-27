import * as _ from 'lodash';
import * as filepath from 'path';
import * as tmp from 'tmp';
import * as vscode from 'vscode';
import * as YAML from 'yamljs';
import { Context, ExecResult, ExternalBinary, invokeForResult } from './binutilplusplus';
import {
    helmChartQuery,
    helmDryRunArgs,
    helmDependencyListArgs,
    helmFetchArgs,
    helmFetchedChartDirectoryName,
    helmFileQuery,
    helmInstallArgs,
    HelmSyntaxVersion,
    isSafeHelmChartReference,
    isSafeHelmChartVersion,
    isExplicitHelmLocalChartReference,
} from './components/helm/commands';
import {
    executeHelmCommand,
    HelmExecutable,
    helmPathForExecution,
    helmRepositoryCommandCwd,
    resolveHelmExecutableForExecution,
} from './components/helm/executable';
import { NODE_TYPES } from './components/clusterexplorer/explorer';
import { ClusterExplorerNode } from './components/clusterexplorer/node';
import { HelmHistoryNode } from './components/clusterexplorer/node.helmrelease';
import { refreshExplorer } from './components/clusterprovider/common/explorer';
import { getToolPath, getUseWsl, suppressHelmNotFound, setSuppressHelmNotFound } from './components/config/config';
import { isSafeNamespace } from './components/kubectl/resource-commands';
import { installDependencies } from './components/installer/installdependencies';
import { Errorable, failed } from './errorable';
import { fs as shellfs } from './fs';
import * as helm from './helm';
import * as helmrepoexplorer from './helm.repoExplorer';
import { host, LongRunningUIOptions } from './host';
import { showWorkspaceFolderPick } from './hostutils';
import { Kubectl } from './kubectl';
import { currentNamespace } from './kubectlUtils';
import { HELM_RESOURCE_AUTHORITY, K8S_RESOURCE_SCHEME } from './kuberesources.virtualfs';
import { helm as logger } from './logger';
import { parseLineOutput } from './outputUtils';
import { ExecCallback, monitorForAuthPrompt, shell as sh, ShellResult } from './shell';
import { openHelmGeneratedValuesFile, preview } from './utils/preview';
import * as fs from './wsl-fs';

export { HelmSyntaxVersion } from './components/helm/commands';

export interface PickChartUIOptions {
    readonly warnIfNoCharts: boolean;
}

export enum EnsureMode {
    Alert,
    Silent,
}

// Schema for repositories.yaml
interface HelmRepositoriesFile {
    readonly repositories: ReadonlyArray<{
        readonly name: string;
        readonly cache: string;  // cache file path
        readonly url: string;
    }>;
}

// Schema for Helm release
// added to support rollback feature
export interface HelmRelease {
    readonly revision:    number;
    readonly updated:     string;
    readonly status:      string;
    readonly chart:       string;
    readonly appVersion:  string;
    readonly description: string;
}

function helmReleaseFromJSON(json: any): HelmRelease {
    return { appVersion: json.app_version, ...json };
}

// This file contains utilities for executing command line tools, notably Helm.

export async function helmVersion() {
    const syntaxVersion = await helmSyntaxVersion();
    const args = syntaxVersion === HelmSyntaxVersion.V3 || syntaxVersion === HelmSyntaxVersion.V4 ? ['version'] : ['version', '-c'];
    const sr = await helmExecArgsAsync(args);
    if (!sr) {
        vscode.window.showErrorMessage('Failed to run Helm');
        return;
    }
    if (sr.code !== 0) {
        vscode.window.showErrorMessage(sr.stderr);
        return;
    }
    vscode.window.showInformationMessage(sr.stdout);
}

let cachedVersion: HelmSyntaxVersion | undefined = undefined;

export async function helmSyntaxVersion(): Promise<HelmSyntaxVersion> {
    if (cachedVersion === undefined) {
        const srHelm2 = await helmExecArgsAsync(['version', '--short', '-c']);
        if (!srHelm2) {
            // failed to run Helm; do not cache result
            return HelmSyntaxVersion.Unknown;
        }

        if (srHelm2.code === 0 && srHelm2.stdout.indexOf('v2') >= 0) {
            cachedVersion = HelmSyntaxVersion.V2;
        } else {
            const srHelm3 = await helmExecArgsAsync(['version', '--short']);
            if (srHelm3 && srHelm3.code === 0) {
                if (srHelm3.stdout.indexOf('v4') >= 0) {
                    cachedVersion = HelmSyntaxVersion.V4;
                } else if (srHelm3.stdout.indexOf('v3') >= 0) {
                    cachedVersion = HelmSyntaxVersion.V3;
                } else {
                    return HelmSyntaxVersion.Unknown;
                }
            } else {
                return HelmSyntaxVersion.Unknown;
            }
        }
    }
    return cachedVersion;
}

// Run a 'helm template' command.
// This looks for Chart.yaml files in the present project. If only one is found, it
// runs 'helm template' on it. If multiples are found, it prompts the user to select one.
export function helmTemplate() {
    pickChart((path) => {
        void withHelmPath(path, (executionPath) =>
            helmExecArgs(['template', executionPath], (code, out, err) => {
                if (code !== 0) {
                    vscode.window.showErrorMessage(err);
                    return;
                }
                vscode.window.showInformationMessage("Chart rendered successfully");
                logger.logAndShow(out);
            })
        );
    });
}

export async function helmTemplatePreview(): Promise<void> {
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

    if (!await resolveHelmForArgs(EnsureMode.Alert)) {
        return;
    }

    const u = vscode.Uri.parse(helm.PREVIEW_URI);
    const f = filepath.basename(filePath);
    preview(u, vscode.ViewColumn.Two, `Preview ${ f }`);
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
    void withHelmPath(path, (executionPath) =>
        helmExecArgs(['dep', 'up', executionPath], (code, out, err) => {
            logger.log(out);
            logger.log(err);
            if (code !== 0) {
                logger.log("⎈⎈⎈ UPDATE FAILED");
            }
        })
    );
}

export async function helmCreate(): Promise<void> {
    const createResult = await helmCreateCore("Chart name", "mychart");

    if (!createResult) {
        return;
    }

    if (failed(createResult)) {
        vscode.window.showErrorMessage(createResult.error[0]);
        return;
    }

    // Show success message and reveal the created chart
    const chartPath = createResult.result.path;
    const chartName = createResult.result.name;

    logger.log(`⎈⎈⎈ Created chart ${chartName} at ${chartPath}`);

    const action = await vscode.window.showInformationMessage(
        `Created Helm chart '${chartName}'`,
        'Open Chart.yaml',
        'Open Folder'
    );

    if (action === 'Open Chart.yaml') {
        const chartYamlPath = filepath.join(chartPath, 'Chart.yaml');
        const doc = await vscode.workspace.openTextDocument(chartYamlPath);
        await vscode.window.showTextDocument(doc);
    } else if (action === 'Open Folder') {
        const chartUri = vscode.Uri.file(chartPath);
        await vscode.commands.executeCommand('revealInExplorer', chartUri);
    }
}

export async function helmCreateCore(prompt: string, sampleName: string): Promise<Errorable<{ name: string; path: string}> | undefined> {
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

    let executionPath: string;
    try {
        executionPath = await helmPathForExecution(fullpath, getUseWsl());
    } catch (err) {
        return { succeeded: false, error: [String(err)] };
    }
    const sr = await helmExecArgsAsync(['create', executionPath]);

    if (!sr || sr.code !== 0) {
        return { succeeded: false, error: [ sr ? sr.stderr : "Unable to run Helm" ] };
    }

    return { succeeded: true, result: { name: name, path: fullpath } };
}

// helmLint runs the Helm linter on a chart within your project.
export function helmLint() {
    pickChart((path) => {
        logger.logAndShow("⎈⎈⎈ Linting " + path);
        void withHelmPath(path, (executionPath) =>
            helmExecArgs(['lint', executionPath], (code, out, err) => {
                logger.logAndShow(out);
                logger.logAndShow(err);
                if (code !== 0) {
                    logger.logAndShow("⎈⎈⎈ LINTING FAILED");
                }
            })
        );
    });
}

export async function helmFetchValues(arg: any): Promise<void> {
    await helmInspect(arg, {
        noTargetMessage:
            "Helm generate values.yaml is for packaged charts and directories. Launch the command from a file or directory in the file explorer. or a chart or version in the Helm Repos explorer.",
        inspectionScheme: helm.FETCH_VALUES_SCHEME,
        generateFile: true,
    });
}

export async function helmInspectChart(arg: any): Promise<void> {
    await helmInspect(arg, {
        noTargetMessage: "Helm Inspect Chart is for packaged charts and directories. Launch the command from a chart or version in the Helm Repos explorer.",
        inspectionScheme: helm.INSPECT_CHART_SCHEME,
        generateFile: false
    });
}

interface InspectionStrategy {
    readonly noTargetMessage: string;
    readonly inspectionScheme: string;
    readonly generateFile: boolean;
}

async function helmInspect(arg: any, s: InspectionStrategy): Promise<void> {
    if (!arg) {
        vscode.window.showErrorMessage(s.noTargetMessage);
        return;
    }
    if (!await resolveHelmForArgs(EnsureMode.Alert)) {
        return;
    }

    if (helmrepoexplorer.isHelmRepoChart(arg) || helmrepoexplorer.isHelmRepoChartVersion(arg)) {
        const id = arg.id;
        const version = helmrepoexplorer.isHelmRepoChartVersion(arg) ? arg.version : undefined;
        if (!isSafeHelmChartReference(id) || (version !== undefined && !isSafeHelmChartVersion(version))) {
            vscode.window.showWarningMessage(`Invalid Helm chart identifier or version. Use Helm CLI to inspect this chart.`);
            return;
        }
        const query = helmChartQuery(id, version);
        if (s.generateFile) {
            const valuesFileName = helmDocumentName(`${id}${version ? `-${version}` : ''}-values.yaml`);
            const uri = vscode.Uri.from({
                scheme: s.inspectionScheme,
                authority: helm.INSPECT_REPO_AUTHORITY,
                path: `/${valuesFileName}`,
                query,
            });
            openHelmGeneratedValuesFile(uri);
        } else {
            const uri = vscode.Uri.from({
                scheme: s.inspectionScheme,
                authority: helm.INSPECT_REPO_AUTHORITY,
                path: `/${helmDocumentName(`${id}.html`)}`,
                query,
            });
            preview(uri, vscode.ViewColumn.Two, "Inspect");
        }
    } else {
        const u = arg as vscode.Uri;
        if (!u || u.scheme !== 'file') {
            vscode.window.showWarningMessage('Helm chart must be on the filesystem.');
            return;
        }
        const uri = vscode.Uri.from({
            scheme: s.inspectionScheme,
            authority: helm.INSPECT_FILE_AUTHORITY,
            path: s.generateFile ? '/values.yaml' : '/chart.html',
            query: helmFileQuery(u.fsPath),
        });
        if (s.generateFile) {
            openHelmGeneratedValuesFile(uri);
        } else {
            preview(uri, vscode.ViewColumn.Two, "Inspect");
        }
    }
}

function helmDocumentName(value: string): string {
    return value.replace(/[^A-Za-z0-9._-]/g, '-');
}

// helmDryRun runs a helm install with --dry-run and --debug set.
export function helmDryRun() {
    pickChart(async (path) => {
        const syntaxVersion = await helmSyntaxVersion();
        let executionPath: string;
        try {
            executionPath = await helmPathForExecution(path, getUseWsl());
        } catch (err) {
            await vscode.window.showErrorMessage(String(err));
            return;
        }
        logger.log("⎈⎈⎈ Installing (dry-run) " + path);
        helmExecArgs(helmDryRunArgs(syntaxVersion, executionPath), (code, out, err) => {
            logger.logAndShow(out);
            logger.logAndShow(err);
            if (code !== 0) {
                logger.logAndShow("⎈⎈⎈ INSTALL FAILED");
            }
        });
    });
}

export function helmGet(resourceNode?: ClusterExplorerNode) {
    if (!resourceNode) {
        return;
    }
    if (
        resourceNode.nodeType !== NODE_TYPES.helm.history &&
        resourceNode.nodeType !== NODE_TYPES.helm.release
    ) {
        return;
    }
    const releaseName = resourceNode.releaseName;
    const revisionNumber = (resourceNode.nodeType === NODE_TYPES.helm.history ? resourceNode.release.revision : undefined);
    const uri = helmfsUri(releaseName, revisionNumber);
    vscode.workspace.openTextDocument(uri).then((doc) => {
        if (doc) {
            vscode.window.showTextDocument(doc);
        }
    });
}

export function helmUninstall(resourceNode?: ClusterExplorerNode) {
    if (!resourceNode) {
        return;
    }
    if (resourceNode.nodeType !== NODE_TYPES.helm.release) {
        return;
    }
    const releaseName = resourceNode.releaseName;
    logger.log("⎈⎈⎈ Uninstalling " + releaseName);
    vscode.window.showWarningMessage(`You are about to uninstall ${releaseName}. This action cannot be undone.`, 'Uninstall').then((opt) => {
        if (opt === "Uninstall") {
            host.longRunning(`Uninstalling ${releaseName}...`, () =>
                helmExecAsync(`del ${releaseName}`).then((sr) => {
                    logger.log(sr?.stdout || "");
                    logger.log(sr?.stderr || "");
                    if (!sr || sr.code !== 0) {
                        logger.log("⎈⎈⎈ UNINSTALL FAILED");
                        vscode.window.showErrorMessage(`Error uninstalling ${releaseName}: ${sr?.stderr || ""}`);
                    } else {
                        vscode.window.showInformationMessage(`Release ${releaseName} successfully uninstalled.`);
                        refreshExplorer();
                    }
                })
            );
        }
    });
}

export async function helmGetHistory(release: string): Promise<Errorable<HelmRelease[]>> {
    if (!ensureHelm(EnsureMode.Alert)) {
        return { succeeded: false, error: [ "Helm client is not installed" ] };
    }
    const sr = await helmExecAsync(`history ${release} --output json`);
    if (!sr || sr.code !== 0) {
        const message = `Helm fetch history failed: ${sr ? sr.stderr : "Unable to run Helm"}`;
        await vscode.window.showErrorMessage(message);
        return { succeeded: false, error: [message] };
    } else {
        const releasesJSON: any[] = JSON.parse(sr.stdout);
        const releases = releasesJSON.map(helmReleaseFromJSON);
        return { succeeded: true, result: releases.reverse() };
    }
}

export async function helmRollback(resourceNode?: HelmHistoryNode) {
    if (!resourceNode) {
        return;
    }
    if (resourceNode.release.status === "deployed") {
        vscode.window.showInformationMessage('This is the currently deployed release');
        return;
    }
    const releaseName = resourceNode.releaseName;
    const release = resourceNode.release;
    vscode.window.showWarningMessage(`You are about to rollback ${releaseName} to release version ${release.revision}. Continue?`, 'Rollback').then((opt) => {
        if (opt === "Rollback") {
            host.longRunning(`Rolling back ${releaseName} to revision ${release.revision}...`, () =>
                helmExecAsync(`rollback ${releaseName} ${release.revision} --cleanup-on-fail`).then((sr) => {
                    logger.log(sr?.stdout || "");
                    logger.log(sr?.stderr || "");
                    if (!sr || sr.code !== 0) {
                        vscode.window.showErrorMessage(`Error rolling back to ${release.revision} for ${releaseName}: ${sr?.stderr || ""}`);
                    } else {
                        vscode.window.showInformationMessage(`Release ${releaseName} successfully rolled back to ${release.revision}.`);
                        refreshExplorer();
                    }
                })
            );
        }
    });
}

export function helmfsUri(releaseName: string, revision: number | undefined): vscode.Uri {
    const revisionSuffix = revision ? `-${revision}` : '';
    const revisionQuery = revision ? `&revision=${revision}` : '';

    const docname = `helmrelease-${releaseName}${revisionSuffix}.txt`;
    const nonce = new Date().getTime();
    const uri = `${K8S_RESOURCE_SCHEME}://${HELM_RESOURCE_AUTHORITY}/${docname}?value=${releaseName}${revisionQuery}&_=${nonce}`;
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
                void Promise.all([
                    helmPathForExecution(path, getUseWsl()),
                    helmPathForExecution(packagePath[0].fsPath, getUseWsl()),
                ]).then(([chartPath, destinationPath]) =>
                    helmExecArgs(['package', chartPath, '-d', destinationPath], (code, out, err) => {
                        logger.log(out);
                        logger.log(err);
                        if (code !== 0) {
                            vscode.window.showErrorMessage(err);
                        }
                    })
                ).catch((err) => vscode.window.showErrorMessage(String(err)));
            }
            return;
        });
    });
}

export async function helmFetch(helmObject: helmrepoexplorer.HelmObject | undefined): Promise<void> {
    if (!helmObject) {
        const id = await vscode.window.showInputBox({ prompt: "Chart to fetch", placeHolder: "stable/mychart" });
        if (id) {
            await helmFetchCore(id, undefined);
        }
        return;
    }
    if (helmrepoexplorer.isHelmRepoChart(helmObject)) {
        await helmFetchCore(helmObject.id, undefined);
    } else if (helmrepoexplorer.isHelmRepoChartVersion(helmObject)) {
        await helmFetchCore(helmObject.id, helmObject.version);
    }
}

async function helmFetchCore(chartId: string, version: string | undefined): Promise<void> {
    if (!isSafeHelmChartReference(chartId)) {
        vscode.window.showWarningMessage(`Unexpected characters in chart name ${chartId}. Use Helm CLI to fetch this chart.`);
        return;
    }
    if (version && !isSafeHelmChartVersion(version)) {
        vscode.window.showWarningMessage(`Unexpected characters in chart version ${version}. Use Helm CLI to fetch this chart.`);
        return;
    }

    const projectFolder = await showWorkspaceFolderPick();
    if (!projectFolder) {
        return;
    }

    const destinationDir = projectFolder.uri.fsPath;
    let executionChartId: string;
    let executionDestination: string;
    try {
        executionChartId = await helmPathForExecution(chartId, getUseWsl());
        executionDestination = await helmPathForExecution(destinationDir, getUseWsl());
    } catch (err) {
        await vscode.window.showErrorMessage(`Helm fetch failed: ${String(err)}`);
        return;
    }

    const sr = await host.longRunning(`Fetching ${chartId}...`, () =>
        helmExecRepositoryArgsAsync(helmFetchArgs(executionChartId, version, executionDestination, true))
    );
    if (!sr || sr.code !== 0) {
        await vscode.window.showErrorMessage(`Helm fetch failed: ${sr ? sr.stderr : "Unable to run Helm"}`);
        return;
    }

    const chartName = helmFetchedChartDirectoryName(chartId);
    if (!chartName) {
        await vscode.window.showInformationMessage(`Fetched ${chartId}`);
        return;
    }
    const chartPath = filepath.join(destinationDir, chartName);

    // Verify the expected path exists before offering quick-actions
    if (!shellfs.existsSync(chartPath)) {
        await vscode.window.showInformationMessage(`Fetched ${chartId}`);
        return;
    }

    const action = await vscode.window.showInformationMessage(
        `Fetched Helm chart '${chartId}'`,
        'Open Chart.yaml',
        'Open Folder'
    );

    if (action === 'Open Chart.yaml') {
        const chartYamlPath = filepath.join(chartPath, 'Chart.yaml');
        try {
            const doc = await vscode.workspace.openTextDocument(chartYamlPath);
            await vscode.window.showTextDocument(doc);
        } catch (err) {
            vscode.window.showErrorMessage(`Could not open Chart.yaml: ${err}`);
        }
    } else if (action === 'Open Folder') {
        const chartUri = vscode.Uri.file(chartPath);
        await vscode.commands.executeCommand('revealInExplorer', chartUri);
    }
}

export async function helmInstall(kubectl: Kubectl, helmObject: helmrepoexplorer.HelmObject | undefined): Promise<void> {
    if (!helmObject) {
        const id = await vscode.window.showInputBox({ prompt: "Chart to install", placeHolder: "stable/mychart" });
        if (id) {
            await helmInstallCore(kubectl, id, undefined, !isExplicitHelmLocalChartReference(id));
        }
        return;
    }
    if (helmrepoexplorer.isHelmRepoChart(helmObject)) {
        await helmInstallCore(kubectl, helmObject.id, undefined, true);
    } else if (helmrepoexplorer.isHelmRepoChartVersion(helmObject)) {
        await helmInstallCore(kubectl, helmObject.id, helmObject.version, true);
    }
}

async function helmInstallCore(kubectl: Kubectl, chartId: string, version: string | undefined, repositoryChart: boolean): Promise<void> {
    if (!isSafeHelmChartReference(chartId)) {
        vscode.window.showWarningMessage(`Unexpected characters in chart name ${chartId}. Use Helm CLI to install this chart.`);
        return;
    }
    if (version && !isSafeHelmChartVersion(version)) {
        vscode.window.showWarningMessage(`Unexpected characters in chart version ${version}. Use Helm CLI to install this chart.`);
        return;
    }

    const syntaxVersion = await helmSyntaxVersion();
    const ns = await currentNamespace(kubectl);
    if (ns && !isSafeNamespace(ns)) {
        await vscode.window.showErrorMessage('Helm install failed: invalid Kubernetes namespace.');
        return;
    }
    let executionChartId: string;
    try {
        executionChartId = await helmPathForExecution(chartId, getUseWsl());
    } catch (err) {
        await vscode.window.showErrorMessage(`Helm install failed: ${String(err)}`);
        return;
    }
    logger.log(`⎈⎈⎈ Installing ${chartId}...`);
    const sr = await host.longRunning(`Installing ${chartId}...`, () =>
        repositoryChart ?
            helmExecRepositoryArgsAsync(helmInstallArgs(syntaxVersion, executionChartId, version, ns || undefined)) :
            helmExecArgsAsync(helmInstallArgs(syntaxVersion, executionChartId, version, ns || undefined))
    );
    if (!sr || sr.code !== 0) {
        const message = sr ? sr.stderr : "Unable to run Helm";
        logger.logAndShow(message);
        await vscode.window.showErrorMessage(`Helm install failed: ${message}`);
        return;
    }
    const releaseName = extractReleaseName(sr.stdout);
    logger.logAndShow(sr.stdout);
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

export async function helmDependencies(helmObject: helmrepoexplorer.HelmObject | undefined): Promise<void> {
    if (!helmObject) {
        const id = await vscode.window.showInputBox({ prompt: "Chart to show dependencies for", placeHolder: "stable/mychart" });
        if (id) {
            await helmDependenciesLaunchViewer(id, undefined);
        }
        return;
    }
    if (helmrepoexplorer.isHelmRepoChart(helmObject)) {
        await helmDependenciesLaunchViewer(helmObject.id, undefined);
    } else if (helmrepoexplorer.isHelmRepoChartVersion(helmObject)) {
        await helmDependenciesLaunchViewer(helmObject.id, helmObject.version);
    }
}

async function helmDependenciesLaunchViewer(chartId: string, version: string | undefined): Promise<void> {
    if (!isSafeHelmChartReference(chartId)) {
        vscode.window.showWarningMessage(`Unexpected characters in chart name ${chartId}. Use Helm CLI to install this chart.`);
        return;
    }
    if (version && !isSafeHelmChartVersion(version)) {
        vscode.window.showWarningMessage(`Unexpected characters in chart version ${version}. Use Helm CLI to install this chart.`);
        return;
    }

    // Boing it back through a HTML preview window
    const uri = vscode.Uri.from({
        scheme: helm.DEPENDENCIES_SCHEME,
        authority: helm.DEPENDENCIES_REPO_AUTHORITY,
        path: '/dependencies.html',
        query: helmChartQuery(chartId, version),
    });
    await preview(uri, vscode.ViewColumn.Two, `${chartId} Dependencies`);
}

export async function helmDependenciesCore(chartId: string, version: string | undefined): Promise<Errorable<{ [key: string]: string }[]>> {
    if (!isSafeHelmChartReference(chartId) || (version !== undefined && !isSafeHelmChartVersion(version))) {
        return { succeeded: false, error: ['Invalid Helm chart identifier or version.'] };
    }
    const tempDirObj = tmp.dirSync({ prefix: "vsk-fetchfordeps-", unsafeCleanup: true });
    try {
        let executionChartId: string;
        let executionDestination: string;
        try {
            executionChartId = await helmPathForExecution(chartId, getUseWsl());
            executionDestination = await helmPathForExecution(tempDirObj.name, getUseWsl());
        } catch (err) {
            return { succeeded: false, error: [String(err)] };
        }
        const fsr = await helmExecRepositoryArgsAsync(helmFetchArgs(executionChartId, version, executionDestination, false));
        if (!fsr || fsr.code !== 0) {
            return { succeeded: false, error: [`Helm fetch failed: ${fsr ? fsr.stderr : "Unable to run Helm"}`] };
        }

        const tempDirFiles = shellfs.dirSync(tempDirObj.name);
        if (tempDirFiles.length !== 1) {
            return { succeeded: false, error: ['Helm fetch returned an unexpected chart archive.'] };
        }
        const chartPath = filepath.join(tempDirObj.name, tempDirFiles[0]);
        let executionChartPath: string;
        try {
            executionChartPath = await helmPathForExecution(chartPath, getUseWsl());
        } catch (err) {
            return { succeeded: false, error: [String(err)] };
        }
        const syntaxVersion = await helmSyntaxVersion();
        const dsr = await helmExecArgsAsync(helmDependencyListArgs(syntaxVersion, executionChartPath));
        if (!dsr || dsr.code !== 0) {
            return { succeeded: false, error: [`Helm dependency list failed: ${dsr ? dsr.stderr : "Unable to run Helm"}`] };
        }
        const lines = dsr.stdout.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length === 1) {
            return { succeeded: false, error: [`${chartId} has no dependencies`] };  // I don't feel good about using an error for this but life is short
        }
        const dependencies = parseLineOutput(lines, helm.HELM_OUTPUT_COLUMN_SEPARATOR);
        return { succeeded: true, result: dependencies };
    } finally {
        tempDirObj.removeCallback();
    }
}

async function withHelmPath(path: string, action: (executionPath: string) => void): Promise<void> {
    try {
        action(await helmPathForExecution(path, getUseWsl()));
    } catch (err) {
        await vscode.window.showErrorMessage(String(err));
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
    findChartFiles().then((matches) => {
        switch (matches.length) {
            case 0:
                vscode.window.showErrorMessage("No Helm charts found in workspace.");
                return;
            case 1:
                // Assume that if there is only one chart, that's the one to run.
                const p = filepath.dirname(matches[0].fsPath);
                fn(p);
                return;
            default:
                // TODO: This would be so much cooler if the QuickPick parsed the Chart.yaml
                // and showed the chart name instead of the path.
                const pathPicks = matches.map((item) =>
                    quickPickForChart(item)
                );
                vscode.window.showQuickPick(pathPicks).then((picked) => {
                    if (picked) {
                        fn(picked.chartDir);
                    }
                });
                return;
        }
    });
}

function quickPickForChart(chartUri: vscode.Uri): vscode.QuickPickItem & { readonly chartDir: string } {
    const chartDir = filepath.dirname(chartUri.fsPath);
    const displayName = vscode.workspace.rootPath ?
        filepath.relative(vscode.workspace.rootPath, chartDir) :
        chartDir;
    return {
        label: displayName || ".",
        chartDir: chartDir
    };
}

interface Chart {
    name: string;
    version: string;
    appVersion: string;
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
export function pickChartForFile(file: string, options: PickChartUIOptions, fn: (path: string) => void) {
    void pickChartForFileAsync(file, options).then((path) => {
        if (path) {
            fn(path);
        }
    });
}

export async function pickChartForFileAsync(file: string, options: PickChartUIOptions): Promise<string | undefined> {
    const matches = await findChartFiles();
    switch (matches.length) {
        case 0:
            if (options.warnIfNoCharts) {
                vscode.window.showErrorMessage("No charts found");
            }
            return undefined;
        case 1:
            return filepath.dirname(matches[0].fsPath);
        default:
            const paths = matches.map((item) => filepath.dirname(item.fsPath))
                .filter((dirname) => {
                    const rel = filepath.relative(dirname, file);
                    return rel.indexOf("..") < 0;
                });

            if (paths.length === 0) {
                if (options.warnIfNoCharts) {
                    vscode.window.showErrorMessage("Chart not found for " + file);
                }
                return undefined;
            }
            return paths[0];
    }
}

function findChartFiles() {
    // Excluding "**/node_modules/**" as a common cause of excessive CPU usage.
    // https://github.com/microsoft/vscode/issues/75314#issuecomment-503195666
    return vscode.workspace.findFiles("**/Chart.yaml", "**/node_modules/**", 1024)
}

// helmExec appends 'args' to a Helm command (helm args...), executes it, and then sends the result to te callback.
// fn should take the signature function(code, stdout, stderr)
//
// This will abort and send an error message if Helm is not installed.

export function helmExecArgs(args: readonly string[], fn: ExecCallback): void {
    void resolveHelmForArgs(EnsureMode.Alert).then(async (executable) => {
        if (!executable) {
            return;
        }
        const result = await executeHelmArgs(executable, args);
        if (result) {
            fn(result.code, result.stdout, result.stderr);
        } else {
            console.log('exec failed: unable to run Helm');
        }
    }, (err) => {
        console.log(`exec failed! (${err})`);
    });
}

export async function helmExecArgsAsync(args: readonly string[]): Promise<ShellResult | undefined> {
    const executable = await resolveHelmForArgs(EnsureMode.Alert);
    if (!executable) {
        return { code: -1, stdout: "", stderr: "" };
    }
    return await executeHelmArgs(executable, args);
}

export async function helmExecRepositoryArgsAsync(args: readonly string[]): Promise<ShellResult | undefined> {
    const executable = await resolveHelmForArgs(EnsureMode.Alert);
    const cwd = helmRepositoryCommandCwd(sh, getUseWsl());
    if (!executable || !cwd) {
        return { code: -1, stdout: "", stderr: "" };
    }
    return await executeHelmArgs(executable, args, cwd);
}

async function executeHelmArgs(executable: HelmExecutable, args: readonly string[], cwd?: string): Promise<ShellResult | undefined> {
    try {
        return await executeHelmCommand(executable, args, sh, getUseWsl(), undefined, monitorForAuthPrompt, cwd);
    } catch (err) {
        vscode.window.showErrorMessage(String(err));
        return undefined;
    }
}

async function resolveHelmForArgs(mode: EnsureMode): Promise<HelmExecutable | undefined> {
    const configuredExecutable = getToolPath(host, sh, 'helm');
    const workspaceRoots = (vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.fsPath);
    let executable: HelmExecutable | undefined;
    try {
        executable = await resolveHelmExecutableForExecution(configuredExecutable, sh, getUseWsl(), undefined, workspaceRoots);
    } catch (err) {
        if (mode === EnsureMode.Alert) {
            await vscode.window.showErrorMessage(String(err));
        }
        return undefined;
    }
    if (executable) {
        return executable;
    }
    const message = configuredExecutable ? `${configuredExecutable} does not exist!` : 'Could not find Helm binary.';
    handleHelmNotFoundError(mode, message);
    return undefined;
}

export function helmExec(args: string, fn: ExecCallback) {
    if (!ensureHelm(EnsureMode.Alert)) {
        return;
    }
    const configuredBin: string | undefined = getToolPath(host, sh, 'helm');
    const bin = configuredBin ? `"${configuredBin}"` : "helm";
    const cmd = `${bin} ${args}`;
    const promise = sh.exec(cmd);
    promise.then((res: ShellResult | undefined) => {
        if (res) {
            fn(res.code, res.stdout, res.stderr);
        } else {
            console.log('exec failed: unable to run Helm');
        }
    }, (err) => {
        console.log(`exec failed! (${err})`);
    });
}

export async function helmExecAsync(args: string): Promise<ShellResult | undefined> {
    // TODO: deduplicate with helmExec
    if (!ensureHelm(EnsureMode.Alert)) {
        return { code: -1, stdout: "", stderr: "" };
    }
    const configuredBin: string | undefined = getToolPath(host, sh, 'helm');
    const bin = configuredBin ? `"${configuredBin}"` : "helm";
    const cmd = `${bin} ${args}`;
    return await sh.exec(cmd);
}

const HELM_BINARY: ExternalBinary = {
    binBaseName: 'helm',
    configKeyName: 'helm',
    displayName: 'Helm',
    offersInstall: true,
};

const HELM_CONTEXT: Context = {
    host: host,
    fs: shellfs,
    shell: sh,
    pathfinder: undefined,
    binary: HELM_BINARY,
    status: undefined,
};

export async function helmInvokeCommand(command: string): Promise<ExecResult> {
    return await invokeForResult(HELM_CONTEXT, command, undefined);
}

export async function helmInvokeCommandWithFeedback(command: string, uiOptions: string | LongRunningUIOptions): Promise<ExecResult> {
    return await HELM_CONTEXT.host.longRunning(uiOptions, () =>
        invokeForResult(HELM_CONTEXT, command, undefined)
    );
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
        const offsetarg: string = offset ? `--offset ${offset}` : "";
        const sr = await helmExecAsync(`list --max 0 ${nsarg} ${offsetarg}`);

        if (!sr || sr.code !== 0) {
            return { succeeded: false, error: [ sr ? sr.stderr : "Unable to run Helm" ] };
        }

        const lines = sr.stdout.split('\n')
                               .map((s) => s.trim())
                               .filter((l) => l.length > 0);
        if (lines.length > 0) {
            if (lines[0].startsWith(HELM_PAGING_PREFIX)) {
                const pagingInfo = lines.shift()!;  // safe because we have checked the length
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
        return handleHelmNotFoundError(mode, `${configuredBin} does not exist!`);
    }
    if (sh.which("helm")) {
        return true;
    }
    return handleHelmNotFoundError(mode, 'Could not find Helm binary.')
}

// Displays error message with option to install dependencies or disable Helm checks.
function handleHelmNotFoundError(mode:EnsureMode, message:string): boolean{
    if (mode === EnsureMode.Alert && !suppressHelmNotFound()) {
        vscode.window.showErrorMessage(message, "Install dependencies", "Disable Helm checks").then((str) =>
        {
            if (str === "Install dependencies") {
                installDependencies();
            } else if (str === "Disable Helm checks") {
                setSuppressHelmNotFound(true);
            }
        });
    }
    return false;
}

export class Requirement {
    public repository: string = "";
    public name: string = "";
    public version: string = "";
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
        if (!val) {
            return;
        }
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
export function searchForChart(name: string): Requirement | undefined {
    const parts = name.split("/", 2);
    if (parts.length !== 2) {
        logger.log("Chart should be of the form REPO/CHARTNAME");
        return undefined;
    }
    const hh = helmHome();
    const reposFile = filepath.join(hh, "repository", "repositories.yaml");
    if (!fs.existsSync(reposFile)) {
        vscode.window.showErrorMessage(`Helm repositories file ${reposFile} not found.`);
        return undefined;
    }
    const repos: HelmRepositoriesFile = YAML.load(reposFile);
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
