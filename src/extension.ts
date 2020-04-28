'use strict';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Standard node imports
import * as os from 'os';
import * as path from 'path';
import { fs } from './fs';

// External dependencies
import * as yaml from 'js-yaml';
import dockerfileParse = require('dockerfile-parse');
import * as tmp from 'tmp';
import * as clipboard from './components/platform/clipboard';
import { pullAll } from 'lodash';

// Internal dependencies
import { host } from './host';
import { addKubernetesConfigFile, deleteKubernetesConfigFile } from './configMap';
import * as explainer from './explainer';
import { shell, ShellResult } from './shell';
import * as configmaps from './configMap';
import * as kuberesources from './kuberesources';
import { useNamespaceKubernetes } from './components/kubectl/namespace';
import { EventDisplayMode, getEvents } from './components/kubectl/events';
import * as docker from './docker';
import { kubeChannel } from './kubeChannel';
import { create as kubectlCreate } from './kubectl';
import * as kubectlUtils from './kubectlUtils';
import * as explorer from './components/clusterexplorer/explorer';
import * as helmRepoExplorer from './helm.repoExplorer';
import { create as draftCreate, CheckPresentMode as DraftCheckPresentMode } from './draft/draft';
import { create as minikubeCreate } from './components/clusterprovider/minikube/minikube';
import * as logger from './logger';
import * as helm from './helm';
import * as helmexec from './helm.exec';
import * as helmauthoring from './helm.authoring';
import { HelmRequirementsCodeLensProvider } from './helm.requirementsCodeLens';
import { HelmTemplateHoverProvider } from './helm.hoverProvider';
import { HelmTemplatePreviewDocumentProvider, HelmInspectDocumentProvider, HelmDependencyDocumentProvider } from './helm.documentProvider';
import { HelmTemplateCompletionProvider } from './helm.completionProvider';
import { Reporter } from './telemetry';
import * as telemetry from './telemetry-helper';
import { dashboardKubernetes } from './components/kubectl/dashboard';
import { portForwardKubernetes } from './components/kubectl/port-forward';
import { logsKubernetes, LogsDisplayMode } from './components/kubectl/logs';
import { Errorable, failed, succeeded } from './errorable';
import { Git } from './components/git/git';
import { DebugSession } from './debug/debugSession';
import { suggestedShellForContainer } from './utils/container-shell';
import { getDebugProviderOfType, getSupportedDebuggerTypes } from './debug/providerRegistry';
import * as config from './components/config/config';
import * as browser from './components/platform/browser';

import { registerYamlSchemaSupport, updateYAMLSchema } from './yaml-support/yaml-schema';
import * as clusterproviderregistry from './components/clusterprovider/clusterproviderregistry';
import * as azureclusterprovider from './components/clusterprovider/azure/azureclusterprovider';
import * as minikubeclusterprovider from './components/clusterprovider/minikube/minikubeclusterprovider';
import { MinikubeOptions } from './components/clusterprovider/minikube/minikube';
import { refreshExplorer } from './components/clusterprovider/common/explorer';
import { KubernetesCompletionProvider } from "./yaml-support/yaml-snippet";
import { showWorkspaceFolderPick } from './hostutils';
import { DraftConfigurationProvider } from './draft/draftConfigurationProvider';
import { KubernetesResourceVirtualFileSystemProvider, K8S_RESOURCE_SCHEME, kubefsUri, K8S_RESOURCE_SCHEME_READONLY, KUBECTL_DESCRIBE_AUTHORITY } from './kuberesources.virtualfs';
import { KubernetesResourceLinkProvider } from './kuberesources.linkprovider';
import { Container, isKubernetesResource, KubernetesCollection, Pod, KubernetesResource } from './kuberesources.objectmodel';
import { setActiveKubeconfig, getKnownKubeconfigs, addKnownKubeconfig } from './components/config/config';
import { HelmDocumentSymbolProvider } from './helm.symbolProvider';
import { findParentYaml } from './yaml-support/yaml-navigation';
import { linters } from './components/lint/linters';
import { runClusterWizard } from './components/clusterprovider/clusterproviderserver';
import { timestampText } from './utils/naming';
import { ContainerContainer } from './utils/containercontainer';
import { APIBroker } from './api/contract/api';
import { apiBroker } from './api/implementation/apibroker';
import { sleep } from './sleep';
import { CloudExplorer, CloudExplorerTreeNode } from './components/cloudexplorer/cloudexplorer';
import { mergeToKubeconfig } from './components/kubectl/kubeconfig';
import { PortForwardStatusBarManager } from './components/kubectl/port-forward-ui';
import { getBuildCommand, getPushCommand } from './image/imageUtils';
import { getImageBuildTool } from './components/config/config';
import { ClusterExplorerNode, ClusterExplorerConfigurationValueNode, ClusterExplorerResourceNode, ClusterExplorerResourceFolderNode } from './components/clusterexplorer/node';
import { create as activeContextTrackerCreate } from './components/contextmanager/active-context-tracker';
import { WatchManager } from './components/kubectl/watch';
import { ExecResult } from './binutilplusplus';
import { getCurrentContext } from './kubectlUtils';
import { setAssetContext } from './assets';

let explainActive = false;
let swaggerSpecPromise: Promise<explainer.SwaggerModel | undefined> | null = null;

const kubernetesDiagnostics = vscode.languages.createDiagnosticCollection("Kubernetes");

const kubectl = kubectlCreate(config.getKubectlVersioning(), host, fs, shell);
const draft = draftCreate(host, fs, shell);
const minikube = minikubeCreate(host, fs, shell);
const clusterProviderRegistry = clusterproviderregistry.get();
const configMapProvider = new configmaps.ConfigMapTextProvider(kubectl);
const git = new Git(shell);
const activeContextTracker = activeContextTrackerCreate(kubectl);

export const overwriteMessageItems: vscode.MessageItem[] = [
    {
        title: "Overwrite"
    },
    {
        title: "Cancel",
        isCloseAffordance: true
    }
];

export const deleteMessageItems: vscode.MessageItem[] = [
    {
        title: "Delete"
    },
    {
        title: "Cancel",
        isCloseAffordance: true
    }
];

// Filters for different Helm file types.
// TODO: Consistently apply these to the providers registered.
export const HELM_MODE: vscode.DocumentFilter = { language: "helm", scheme: "file" };
export const HELM_REQ_MODE: vscode.DocumentFilter = { language: "helm", scheme: "file", pattern: "**/requirements.yaml"};
export const HELM_CHART_MODE: vscode.DocumentFilter = { language: "helm", scheme: "file", pattern: "**/Chart.yaml" };
export const HELM_TPL_MODE: vscode.DocumentFilter = { language: "helm", scheme: "file", pattern: "**/templates/*.*" };

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext): Promise<APIBroker> {
    setAssetContext(context);

    kubectl.ensurePresent({ warningIfNotPresent: 'Kubectl not found. Many features of the Kubernetes extension will not work.' });

    const treeProvider = explorer.create(kubectl, host);
    const helmRepoTreeProvider = helmRepoExplorer.create(host);
    const cloudExplorer = new CloudExplorer();
    const resourceDocProvider = new KubernetesResourceVirtualFileSystemProvider(kubectl, host);
    const resourceLinkProvider = new KubernetesResourceLinkProvider();
    const previewProvider = new HelmTemplatePreviewDocumentProvider();
    const inspectProvider = new HelmInspectDocumentProvider();
    const dependenciesProvider = new HelmDependencyDocumentProvider();
    const helmSymbolProvider = new HelmDocumentSymbolProvider();
    const completionProvider = new HelmTemplateCompletionProvider();
    const completionFilter = [
        "helm",
        {pattern: "**/templates/NOTES.txt"}
    ];

    const draftDebugProvider = new DraftConfigurationProvider();
    let draftDebugSession: vscode.DebugSession;

    const portForwardStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    const portForwardStatusBarManager = PortForwardStatusBarManager.init(portForwardStatusBarItem);

    const activeNamespaceStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
    activeNamespaceStatusBarItem.command = 'extension.vsKubernetesUseNamespace';

    const activeContextStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 2);
    activeContextStatusBarItem.command = 'extension.vsKubernetesUseContext';

    minikube.checkUpgradeAvailable();

    const subscriptions = [

        // Commands - Kubernetes
        registerCommand('extension.vsKubernetesCreate',
            () => maybeRunKubernetesCommandForActiveWindow('create', "Kubernetes Creating...")
        ),
        registerCommand('extension.vsKubernetesCreateFile',
            (uri: vscode.Uri) => kubectlUtils.createResourceFromUri(uri, kubectl)),
        registerCommand('extension.vsKubernetesDeleteUri',
            (uri: vscode.Uri) => kubectlUtils.deleteResourceFromUri(uri, kubectl)),
        registerCommand('extension.vsKubernetesApplyFile',
            (uri: vscode.Uri) => kubectlUtils.applyResourceFromUri(uri, kubectl)),
        registerCommand('extension.vsKubernetesDelete', (explorerNode: ClusterExplorerResourceNode) => { deleteKubernetes(KubernetesDeleteMode.Graceful, explorerNode); }),
        registerCommand('extension.vsKubernetesDeleteNow', (explorerNode: ClusterExplorerResourceNode) => { deleteKubernetes(KubernetesDeleteMode.Now, explorerNode); }),
        registerCommand('extension.vsKubernetesDescribe.Refresh', () => refreshDescribeKubernetes(resourceDocProvider)),
        registerCommand('extension.vsKubernetesApply', applyKubernetes),
        registerCommand('extension.vsKubernetesExplain', explainActiveWindow),
        registerCommand('extension.vsKubernetesLoad', loadKubernetes),
        registerCommand('extension.vsKubernetesGet', getKubernetes),
        registerCommand('extension.vsKubernetesRun', runKubernetes),
        registerCommand('extension.vsKubernetesShowLogs', (explorerNode: ClusterExplorerResourceNode) => { logsKubernetes(kubectl, explorerNode, LogsDisplayMode.Show); }),
        registerCommand('extension.vsKubernetesFollowLogs', (explorerNode: ClusterExplorerResourceNode) => { logsKubernetes(kubectl, explorerNode, LogsDisplayMode.Follow); }),
        registerCommand('extension.vsKubernetesExpose', exposeKubernetes),
        registerCommand('extension.vsKubernetesDescribe', describeKubernetes),
        registerCommand('extension.vsKubernetesSync', syncKubernetes),
        registerCommand('extension.vsKubernetesExec', execKubernetes),
        registerCommand('extension.vsKubernetesTerminal', terminalKubernetes),
        registerCommand('extension.vsKubernetesDiff', diffKubernetes),
        registerCommand('extension.vsKubernetesScale', scaleKubernetes),
        registerCommand('extension.vsKubernetesDebug', debugKubernetes),
        registerCommand('extension.vsKubernetesRemoveDebug', removeDebugKubernetes),
        registerCommand('extension.vsKubernetesDebugAttach', debugAttachKubernetes),
        registerCommand('extension.vsKubernetesConfigureFromCluster', configureFromClusterKubernetes),
        registerCommand('extension.vsKubernetesCreateCluster', createClusterKubernetes),
        registerCommand('extension.vsKubernetesRefreshExplorer', () => treeProvider.refresh()),
        registerCommand('extension.vsKubernetesRefreshHelmRepoExplorer', () => helmRepoTreeProvider.refresh()),
        registerCommand('extension.vsKubernetesRefreshCloudExplorer', () => cloudExplorer.refresh()),
        registerCommand('extension.vsKubernetesUseContext', useContextKubernetes),
        registerCommand('extension.vsKubernetesUseKubeconfig', useKubeconfigKubernetes),
        registerCommand('extension.vsKubernetesClusterInfo', clusterInfoKubernetes),
        registerCommand('extension.vsKubernetesDeleteContext', deleteContextKubernetes),
        registerCommand('extension.vsKubernetesUseNamespace', (explorerNode: ClusterExplorerNode) => { useNamespaceKubernetes(kubectl, explorerNode); } ),
        registerCommand('extension.vsKubernetesDashboard', () => { dashboardKubernetes(kubectl); }),
        registerCommand('extension.vsKubernetesAddWatch', (explorerNode: ClusterExplorerNode) => { addWatch(treeProvider, explorerNode); }),
        registerCommand('extension.vsKubernetesDeleteWatch', (explorerNode: ClusterExplorerNode) => { deleteWatch(treeProvider, explorerNode); }),
        registerCommand('extension.vsMinikubeStop', () => minikube.stop()),
        registerCommand('extension.vsMinikubeStart', () => minikube.start({} as MinikubeOptions)),
        registerCommand('extension.vsMinikubeStatus', async () => {
            try {
                const status = await minikube.status();
                kubeChannel.showOutput(status.message, "Minikube status");
            } catch (err) {
                vscode.window.showErrorMessage(`Error getting status ${err}`);
            }
        }),
        registerCommand('extension.vsKubernetesCopy', copyKubernetes),
        registerCommand('extension.vsKubernetesPortForward', (explorerNode: ClusterExplorerResourceNode) => { portForwardKubernetes(kubectl, explorerNode); }),
        registerCommand('extension.vsKubernetesLoadConfigMapData', configmaps.loadConfigMapData),
        registerCommand('extension.vsKubernetesDeleteFile', (explorerNode: ClusterExplorerConfigurationValueNode) => { deleteKubernetesConfigFile(kubectl, explorerNode, treeProvider); }),
        registerCommand('extension.vsKubernetesAddFile', (explorerNode: ClusterExplorerResourceNode) => { addKubernetesConfigFile(kubectl, explorerNode, treeProvider); }),
        registerCommand('extension.vsKubernetesShowEvents', (explorerNode: ClusterExplorerResourceNode) => { getEvents(kubectl, EventDisplayMode.Show, explorerNode); }),
        registerCommand('extension.vsKubernetesFollowEvents', (explorerNode: ClusterExplorerResourceNode) => { getEvents(kubectl, EventDisplayMode.Follow, explorerNode); }),
        registerCommand('extension.vsKubernetesCronJobRunNow', cronJobRunNow),
        registerCommand('kubernetes.portForwarding.showSessions', () => portForwardStatusBarManager.showSessions()),
        // Commands - Helm
        registerCommand('extension.helmVersion', helmexec.helmVersion),
        registerCommand('extension.helmTemplate', helmexec.helmTemplate),
        registerCommand('extension.helmTemplatePreview', helmexec.helmTemplatePreview),
        registerCommand('extension.helmLint', helmexec.helmLint),
        registerCommand('extension.helmInspectValues', helmexec.helmInspectValues),
        registerCommand('extension.helmInspectChart', helmexec.helmInspectChart),
        registerCommand('extension.helmDryRun', helmexec.helmDryRun),
        registerCommand('extension.helmDepUp', helmexec.helmDepUp),
        registerCommand('extension.helmInsertReq', helmexec.insertRequirement),
        registerCommand('extension.helmCreate', helmexec.helmCreate),
        registerCommand('extension.helmGet', helmexec.helmGet),
        registerCommand('extension.helmPackage', helmexec.helmPackage),
        registerCommand('extension.helmFetch', helmexec.helmFetch),
        registerCommand('extension.helmInstall', (o) => helmexec.helmInstall(kubectl, o)),
        registerCommand("extension.helmUninstall", helmexec.helmUninstall),
        registerCommand("extension.helmRollback", helmexec.helmRollback),
        registerCommand('extension.helmDependencies', helmexec.helmDependencies),
        registerCommand('extension.helmConvertToTemplate', helmConvertToTemplate),
        registerCommand('extension.helmParameterise', helmParameterise),

        // Commands - Draft
        registerCommand('extension.draftVersion', execDraftVersion),
        registerCommand('extension.draftCreate', execDraftCreate),
        registerCommand('extension.draftUp', execDraftUp),

        // Commands - API
        registerCommand('kubernetes.cloudExplorer.mergeIntoKubeconfig', kubernetesMergeIntoKubeconfig),
        registerCommand('kubernetes.cloudExplorer.saveKubeconfig', kubernetesSaveKubeconfig),
        registerCommand('kubernetes.cloudExplorer.findProviders', kubernetesFindCloudProviders),

        // Commands - special no-op command for debouncing concurrent activations
        vscode.commands.registerCommand('extension.vsKubernetesDebounceActivation', () => {}),

        // Commands - general
        registerCommand('extension.showInfoMessage', showInfoMessage),

        // Draft debug configuration provider
        vscode.debug.registerDebugConfigurationProvider('draft', draftDebugProvider),

        // HTML renderers
        vscode.workspace.registerTextDocumentContentProvider(helm.PREVIEW_SCHEME, previewProvider),
        vscode.workspace.registerTextDocumentContentProvider(helm.INSPECT_VALUES_SCHEME, inspectProvider),
        vscode.workspace.registerTextDocumentContentProvider(helm.INSPECT_CHART_SCHEME, inspectProvider),
        vscode.workspace.registerTextDocumentContentProvider(helm.DEPENDENCIES_SCHEME, dependenciesProvider),

        // Completion providers
        vscode.languages.registerCompletionItemProvider(completionFilter, completionProvider),
        vscode.languages.registerCompletionItemProvider('yaml', new KubernetesCompletionProvider(context)),

        // Symbol providers
        vscode.languages.registerDocumentSymbolProvider({ language: 'helm' }, helmSymbolProvider),

        // Hover providers
        vscode.languages.registerHoverProvider(
            { language: 'json' },
            { provideHover: provideHoverJson }
        ),
        vscode.languages.registerHoverProvider(
            { language: 'yaml' },
            { provideHover: provideHoverYaml }
        ),
        vscode.languages.registerHoverProvider(HELM_MODE, new HelmTemplateHoverProvider()),

        // Tree data providers
        vscode.window.registerTreeDataProvider('extension.vsKubernetesExplorer', treeProvider),
        vscode.window.registerTreeDataProvider('extension.vsKubernetesHelmRepoExplorer', helmRepoTreeProvider),
        vscode.window.registerTreeDataProvider('kubernetes.cloudExplorer', cloudExplorer),

        // Temporarily loaded resource providers
        vscode.workspace.registerFileSystemProvider(K8S_RESOURCE_SCHEME, resourceDocProvider, { /* TODO: case sensitive? */ }),
        vscode.workspace.registerFileSystemProvider(K8S_RESOURCE_SCHEME_READONLY, resourceDocProvider, { isReadonly: true }),

        // Link from resources to referenced resources
        vscode.languages.registerDocumentLinkProvider({ scheme: K8S_RESOURCE_SCHEME }, resourceLinkProvider),

        // Code lenses
        vscode.languages.registerCodeLensProvider(HELM_REQ_MODE, new HelmRequirementsCodeLensProvider()),

        // Status bar
        portForwardStatusBarItem,
        activeNamespaceStatusBarItem,
        activeContextStatusBarItem,

        // Telemetry
        registerTelemetry(context),

        treeProvider.initialize()
    ];

    telemetry.invalidateClusterType(undefined, kubectl);

    await azureclusterprovider.init(clusterProviderRegistry, { shell: shell, fs: fs });
    await minikubeclusterprovider.init(clusterProviderRegistry, { shell: shell, minikube: minikube });
    // On save, refresh the Helm YAML preview.
    vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {
        const activeTextEditor = vscode.window.activeTextEditor;
        if (!activeTextEditor) {
            if (helm.hasPreviewBeenShown()) {
                logger.helm.log("WARNING: No active editor during save. Helm preview was not updated.");
            }
            return;
        }
        if (e === activeTextEditor.document) {
            const doc = activeTextEditor.document;
            if (doc.uri.scheme !== "file") {
                return;
            }
            const u = vscode.Uri.parse(helm.PREVIEW_URI);
            previewProvider.update(u);
        }

        // if there is an active Draft debugging session, restart the cycle
        if (draftDebugSession !== undefined) {
            const session = vscode.debug.activeDebugSession;

            // TODO - how do we make sure this doesn't affect all other debugging sessions?
            // TODO - maybe check to see if `draft.toml` is present in the workspace
            // TODO - check to make sure we enable this only when Draft is installed
            if (session !== undefined) {
                draftDebugSession.customRequest('evaluate', { restart: true });
            }
        }
    });

    vscode.debug.onDidTerminateDebugSession((_e) => {

        // if there is an active Draft debugging session, restart the cycle
        if (draftDebugSession !== undefined) {
            const session = vscode.debug.activeDebugSession;

            // TODO - how do we make sure this doesn't affect all other debugging sessions?
            // TODO - maybe check to see if `draft.toml` is present in the workspace
            // TODO - check to make sure we enable this only when Draft is installed
            if (session !== undefined) {
                draftDebugSession.customRequest('evaluate', { stop: true });
            }
        }
    });

    // On editor change, refresh the Helm YAML preview
    vscode.window.onDidChangeActiveTextEditor((_e: vscode.TextEditor | undefined) => {
        const activeTextEditor = vscode.window.activeTextEditor;
        if (!activeTextEditor) {
            return;
        }
        const doc = activeTextEditor.document;
        if (doc.uri.scheme !== "file") {
            return;
        }
        const u = vscode.Uri.parse(helm.PREVIEW_URI);
        previewProvider.update(u);
    });

    vscode.debug.onDidChangeActiveDebugSession((e: vscode.DebugSession | undefined)=> {
        if (e !== undefined) {
            // keep a copy of the initial Draft debug session
            if (e.name.indexOf('Draft') >= 0) {
                draftDebugSession = e;
            }
        }
    });

    vscode.workspace.onDidOpenTextDocument(kubernetesLint);
    vscode.workspace.onDidChangeTextDocument((e) => kubernetesLint(e.document));  // TODO: we could use the change hint
    vscode.workspace.onDidSaveTextDocument(kubernetesLint);
    vscode.workspace.onDidCloseTextDocument((d) => kubernetesDiagnostics.delete(d.uri));
    vscode.workspace.textDocuments.forEach(kubernetesLint);

    subscriptions.forEach((element) => {
        context.subscriptions.push(element);
    });

    activeContextTracker.activeChanged(async (context) => {
        const currentContext = await getCurrentContext(kubectl, { silent: true });
        if (!currentContext) { return; }
        updateStatusBarItem(activeContextStatusBarItem, context!, `${currentContext.contextName}\nCluster: ${currentContext.clusterName}`, !config.isContextStatusBarDisabled());
    });

    kubectlUtils.onDidChangeNamespaceEmitter.event((namespace) => {
        updateStatusBarItem(activeNamespaceStatusBarItem, namespace, 'Current active namespace', !config.isNamespaceStatusBarDisabled());
    });
    const currentNS = await kubectlUtils.currentNamespace(kubectl);
    updateStatusBarItem(activeNamespaceStatusBarItem, currentNS, 'Current active namespace', !config.isNamespaceStatusBarDisabled());

    await registerYamlSchemaSupport(activeContextTracker, kubectl);

    vscode.workspace.registerTextDocumentContentProvider(configmaps.uriScheme, configMapProvider);

    return apiBroker(clusterProviderRegistry, kubectl, portForwardStatusBarManager, treeProvider, cloudExplorer);
}

// this method is called when your extension is deactivated
export const deactivate = () => { };

function registerCommand(command: string, callback: (...args: any[]) => any): vscode.Disposable {
    const wrappedCallback = telemetry.telemetrise(command, kubectl, callback);
    return vscode.commands.registerCommand(command, wrappedCallback);
}

function registerTelemetry(context: vscode.ExtensionContext): vscode.Disposable {
    return new Reporter(context);
}

interface Syntax {
    parse(text: string): any;
    findParent(document: vscode.TextDocument, line: number): number;
}

function provideHover(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken, syntax: Syntax): Promise<vscode.Hover | null> {
    return new Promise(async (resolve, reject) => {
        if (!explainActive) {
            resolve(null);
            return;
        }

        const body = document.getText();
        let obj: any = {};

        try {
            obj = syntax.parse(body);
        } catch (err) {
            // Bad document, return nothing
            // TODO: at least verbose log here?
            resolve(null);
            return;
        }

        // Not a k8s object.
        if (!obj.kind) {
            resolve(null);
            return;
        }

        const property = findProperty(document.lineAt(position.line));
        let field = syntax.parse(property),
            parentLine = syntax.findParent(document, position.line);

        while (parentLine !== -1) {
            const parentProperty = findProperty(document.lineAt(parentLine));
            field = `${syntax.parse(parentProperty)}.${field}`;
            parentLine = syntax.findParent(document, parentLine);
        }

        if (field === 'kind') {
            field = '';
        }

        explain(obj, field).then(
            (msg) => resolve(msg ? new vscode.Hover(msg) : null),
            (err: any) => reject(err)
        );
    });

}

function provideHoverJson(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | null> {
    const syntax: Syntax = {
        parse: (text) => JSON.parse(text),
        findParent: (document, parentLine) => findParentJson(document, parentLine - 1)
    };

    return provideHover(document, position, token, syntax);
}

function provideHoverYaml(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | null> {
    const syntax: Syntax = {
        parse: (text) => yaml.safeLoad(text),
        findParent: (document, parentLine) => findParentYaml(document, parentLine)
    };
    return provideHover(document, position, token, syntax);
}

function findProperty(line: vscode.TextLine): string {
    const ix = line.text.indexOf(':');
    return line.text.substring(line.firstNonWhitespaceCharacterIndex, ix);
}

function findParentJson(document: vscode.TextDocument, line: number): number {
    let count = 1;
    while (line >= 0) {
        const txt = document.lineAt(line);
        if (txt.text.indexOf('}') !== -1) {
            count = count + 1;
        }
        if (txt.text.indexOf('{') !== -1) {
            count = count - 1;
            if (count === 0) {
                break;
            }
        }
        line = line - 1;
    }
    while (line >= 0) {
        const txt = document.lineAt(line);
        if (txt.text.indexOf(':') !== -1) {
            return line;
        }
        line = line - 1;
    }
    return line;
}

async function explain(obj: any, field: string): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
        if (!obj.kind) {
            vscode.window.showErrorMessage("Not a Kubernetes API Object!");
            resolve(null);
        }

        let ref = obj.kind;
        if (field && field.length > 0) {
            ref = `${ref}.${field}`;
        }

        if (!swaggerSpecPromise) {
            swaggerSpecPromise = explainer.readSwagger();
        }

        swaggerSpecPromise.then(
            (s) => {
                if (s) {
                    resolve(explainer.readExplanation(s, ref));
                }
            },
            (err) => {
                vscode.window.showErrorMessage(`Explain failed: ${err}`);
                swaggerSpecPromise = null;
                resolve(null);
            });
    });
}

function explainActiveWindow() {
    const editor = vscode.window.activeTextEditor;
    const bar = initStatusBar();

    if (!editor) {
        vscode.window.showErrorMessage('No active editor!');
        bar.hide();
        return; // No open text editor
    }

    explainActive = !explainActive;
    if (explainActive) {
        vscode.window.showInformationMessage('Kubernetes API explain activated.');
        bar.show();
        if (!swaggerSpecPromise) {
            swaggerSpecPromise = explainer.readSwagger();
        }
    } else {
        vscode.window.showInformationMessage('Kubernetes API explain deactivated.');
        bar.hide();
    }
}

let statusBarItem: vscode.StatusBarItem | undefined = undefined;

function initStatusBar() {
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        statusBarItem.text = 'kubernetes-api-explain';
    }

    return statusBarItem;
}

// const GENERIC_KUBECTL_RESULT_HANDLER: ShellHandler = (code, stdout, stderr) => {
//     if (code !== 0) {
//         host.showErrorMessage('Kubectl command failed: ' + stderr);
//         console.log(stderr);
//         kubectl.checkPossibleIncompatibility();
//         return;
//     }

//     updateYAMLSchema();  // TODO: I really do not like having this here. Massive separation of concerns red flag plus we lack context to decide whether it's needed. But hard to move without revamping the result handling system.
//     host.showInformationMessage(stdout);
// };

// Runs a command for the text in the active window.
// Expects that it can append a filename to 'command' to create a complete kubectl command.
//
// @parameter command string The command to run
function maybeRunKubernetesCommandForActiveWindow(command: string, progressMessage: string) {
    let text: string;

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('This command operates on the open document. Open your Kubernetes resource file, and try again.');
        return false; // No open text editor
    }

    const namespace = config.getConfiguredNamespace();
    if (namespace) {
        command = `${command} --namespace ${namespace} `;
    }

    const isKubernetesSyntax = (editor.document.languageId === 'json' || editor.document.languageId === 'yaml');
    const couldUpdateSchema = (command === 'create' || command === 'apply');  // This is a very crude test in case we modified a CRD
    const resultHandler: (er: ExecResult) => void = isKubernetesSyntax ?
        (er) => kubectl.reportResult(er, { updateSchemasOnSuccess: couldUpdateSchema }) :
        (er) => {
            if (er.resultKind === 'exec-succeeded') {
                if (command === 'create' || command === 'apply') {
                    // This is a very crude test - it would be nice to check if we have modified a CRD.
                    // But the current structure of the code does not support that.
                    updateYAMLSchema();
                }
                vscode.window.showInformationMessage(er.stdout);
            } else {
                vscode.window.showErrorMessage(`Kubectl command failed. The open document might not be a valid Kubernetes resource.  Details: ${ExecResult.failureMessage(er, {})}`);
            }
        };

    if (editor.selection) {
        text = editor.document.getText(editor.selection);
        if (text.length > 0) {
            kubectlViaTempFile(command, text, progressMessage, resultHandler);
            return true;
        }
    }
    if (editor.document.isUntitled) {
        text = editor.document.getText();
        if (text.length > 0) {
            kubectlViaTempFile(command, text, progressMessage, resultHandler);
            return true;
        }
        return false;
    }

    // TODO: unify these paths now we handle non-file URIs
    if (editor.document.isDirty) {
        // TODO: I18n this?
        const confirm = "Save";
        const promise = vscode.window.showWarningMessage("You have unsaved changes!", confirm);
        promise.then((value) => {
            if (value && value === confirm) {
                editor.document.save().then((ok) => {
                    if (!ok) {
                        vscode.window.showErrorMessage("Save failed.");
                        return;
                    }
                    kubectlTextDocument(command, editor.document, progressMessage, resultHandler);
                }, (err) => {
                    vscode.window.showErrorMessage(`Error saving: ${err}`);
                });
            }
        },
        (err) => vscode.window.showErrorMessage(`Error confirming save: ${err}`));
    } else {
        kubectlTextDocument(command, editor.document, progressMessage, resultHandler);
    }
    return true;
}

function convertWindowsToWSL(filePath: string): string {
    const drive = filePath[0].toLowerCase();
    const path = filePath.substring(2).replace(/\\/g, '/');
    return `/mnt/${drive}/${path}`;
}

function kubectlTextDocument(command: string, document: vscode.TextDocument, progressMessage: string, resultHandler: (er: ExecResult) => void): void {
    if (document.uri.scheme === 'file') {
        let fileName = document.fileName;
        if (config.getUseWsl()) {
            fileName = convertWindowsToWSL(fileName);
        }
        const fullCommand = `${command} -f "${fileName}"`;
        kubectl.invokeCommandWithFeedbackThen(fullCommand, progressMessage, resultHandler);
    } else {
        kubectlViaTempFile(command, document.getText(), progressMessage, resultHandler);
    }
}

function kubectlViaTempFile(command: string, fileContent: string, progressMessage: string, handler: (er: ExecResult) => void) {
    const tmpobj = tmp.fileSync();
    fs.writeFileSync(tmpobj.name, fileContent);

    let fileName = tmpobj.name;
    if (config.getUseWsl()) {
        fileName = convertWindowsToWSL(fileName);
    }
    kubectl.invokeCommandWithFeedbackThen(`${command} -f ${fileName}`, progressMessage, handler);
}

/**
 * Gets the text content (in the case of unsaved or selections), or the filename
 *
 * @param callback function(text, filename)
 */
function getTextForActiveWindow(callback: (data: string | null, file: vscode.Uri | null) => void) {
    let text;
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('No active editor!');
        callback(null, null);
        return;
    }

    if (editor.selection) {
        text = editor.document.getText(editor.selection);

        if (text.length > 0) {
            callback(text, null);
            return;
        }
    }

    if (editor.document.isUntitled) {
        text = editor.document.getText();

        if (text.length === 0) {
            return;
        }

        callback(text, null);
        return;
    }

    if (editor.document.isDirty) {
        // TODO: I18n this?
        const confirm = 'Save';
        const promise = vscode.window.showWarningMessage('You have unsaved changes!', confirm);
        promise.then((value) => {
            if (!value) {
                return;
            }

            if (value !== confirm) {
                return;
            }

            editor.document.save().then((ok) => {
                if (!ok) {
                    vscode.window.showErrorMessage('Save failed.');
                    callback(null, null);
                    return;
                }

                callback(null, editor.document.uri);
            });

            return;
        }, (err) => vscode.window.showErrorMessage(`Error saving changes: ${err}`));
    }

    callback(null, editor.document.uri);
    return;
}

async function loadKubernetes(explorerNode?: ClusterExplorerResourceNode) {
    if (explorerNode) {
        loadKubernetesCore(explorerNode.namespace, explorerNode.kindName);
    } else {
        const value = await promptKindName(kuberesources.commonKinds, "load", { nameOptional: true });
        if (value) {
            loadKubernetesCore(null, value);
        }
    }
}

function loadKubernetesCore(namespace: string | null, value: string) {
    const outputFormat = config.getOutputFormat();
    const uri = kubefsUri(namespace, value, outputFormat);
    vscode.workspace.openTextDocument(uri).then((doc) => {
        if (doc) {
            vscode.window.showTextDocument(doc);
        }
    },
    (err) => vscode.window.showErrorMessage(`Error loading document: ${err}`));
}

async function exposeKubernetes() {
    const kindName = await findKindNameOrPrompt(kuberesources.exposableKinds, 'expose', { nameOptional: false});
    if (!kindName) {
        return;
    }

    let cmd = `expose ${kindName}`;
    const ports = getPorts();

    if (ports && ports.length > 0) {
        cmd += ' --port=' + ports[0];
    }

    const er = await host.longRunning(`Exposing ${kindName} as service...`, () =>
        kubectl.invokeCommand(cmd)
    );
    await kubectl.reportResult(er, {});
}

function kubectlId(explorerNode: ClusterExplorerResourceNode | ClusterExplorerResourceFolderNode) {
    if (explorerNode.nodeType === explorer.NODE_TYPES.resource) {
        return explorerNode.kindName;
    }
    return explorerNode.kind.abbreviation;
}

async function getKubernetes(explorerNode?: any) {
    if (explorerNode) {
        const node = explorerNode as ClusterExplorerResourceNode | ClusterExplorerResourceFolderNode;
        const id = kubectlId(node);
        const nsarg = (node.nodeType === explorer.NODE_TYPES.resource && node.namespace) ? `--namespace ${node.namespace}` : '';
        kubectl.invokeInSharedTerminal(`get ${id} ${nsarg} -o wide`);
    } else {
        const value = await findKindNameOrPrompt(kuberesources.commonKinds, 'get', { nameOptional: true });
        if (value) {
            kubectl.invokeInSharedTerminal(` get ${value} -o wide`);
        }
    }
}

function addWatch(tree: explorer.KubernetesExplorer, explorerNode?: ClusterExplorerNode) {
    if (explorerNode) {
        tree.watch(explorerNode);
    }
}

function deleteWatch(tree: explorer.KubernetesExplorer, explorerNode?: ClusterExplorerNode) {
    if (explorerNode) {
        tree.stopWatching(explorerNode);
    }
}

function findVersion() {
    return {
        then: findVersionInternal
    };
}

function findVersionInternal(fn: (text: string) => void): void {
    if (!vscode.workspace.rootPath) {
        vscode.window.showErrorMessage("This command requires a single open folder.");
        return;
    }

    // No .git dir, use 'latest'
    // TODO: use 'git rev-parse' to detect upstream directories
    if (!fs.existsSync(path.join(vscode.workspace.rootPath, '.git'))) {
        fn('latest');
        return;
    }

    shell.execCore('git describe --always --dirty', shell.execOpts()).then(
        ({code, stdout, stderr}) => {
            if (code !== 0) {
                vscode.window.showErrorMessage('git log returned: ' + code);
                console.log(stderr);
                fn('error');
                return;
            }
            fn(stdout);
        }, (err) => {
            fn('error');
            vscode.window.showErrorMessage(`git describe failed: ${err}`);
        });
}

export async function findAllPods(): Promise<FindPodsResult> {
    return await findPodsCore('');
}

async function findPodsByLabel(labelQuery: string): Promise<FindPodsResult> {
    return await findPodsCore(`-l ${labelQuery}`);
}

async function findPodsCore(findPodCmdOptions: string): Promise<FindPodsResult> {
    const podList = await kubectl.asJson<KubernetesCollection<Pod>>(` get pods -o json ${findPodCmdOptions}`);

    if (failed(podList)) {
        vscode.window.showErrorMessage('Kubectl command failed: ' + podList.error[0]);
        return { succeeded: false, pods: [] };
    }

    try {
        return { succeeded: true, pods: podList.result.items };
    } catch (ex) {
        console.log(ex);
        vscode.window.showErrorMessage('unexpected error: ' + ex);
        return { succeeded: false, pods: [] };
    }
}

async function findPodsForApp(): Promise<FindPodsResult> {
    if (!vscode.workspace.rootPath) {
        return { succeeded: true, pods: [] };
    }
    const appName = path.basename(vscode.workspace.rootPath);
    return await findPodsByLabel(`run=${appName}`);
}

async function findDebugPodsForApp(): Promise<FindPodsResult> {
    if (!vscode.workspace.rootPath) {
        return { succeeded: true, pods: [] };
    }
    const appName = path.basename(vscode.workspace.rootPath);
    return await findPodsByLabel(`run=${appName}-debug`);
}

export interface FindPodsResult {
    readonly succeeded: boolean;
    readonly pods: Pod[];
}

function findNameAndImage() {
    return {
        then: findNameAndImageInternal
    };
}

function findNameAndImageInternal(fn: (name: string, image: string) => void) {
    if (vscode.workspace.rootPath === undefined) {
        vscode.window.showErrorMessage('This command requires an open folder.');
        return;
    }
    const folderName = path.basename(vscode.workspace.rootPath);
    const name = docker.sanitiseTag(folderName);
    findVersion().then((version) => {
        let image = `${name}:${version}`;
        const user = vscode.workspace.getConfiguration().get("vsdocker.imageUser", null);
        if (user) {
            image = `${user}/${image}`;
        }

        fn(name.trim(), image.trim());
    });
}

async function scaleKubernetes(target?: any) {
    if (target && explorer.isKubernetesExplorerResourceNode(target)) {
        const kindName = target.kindName;
        promptScaleKubernetes(kindName);
    } else {
        const kindName = await findKindNameOrPrompt(kuberesources.scaleableKinds, 'scale', {});
        if (kindName) {
            promptScaleKubernetes(kindName);
        }
    }
}

function promptScaleKubernetes(kindName: string) {
    vscode.window.showInputBox({ prompt: `How many replicas would you like to scale ${kindName} to?` }).then((value) => {
        if (value) {
            const replicas = parseFloat(value);
            if (Number.isInteger(replicas) && replicas >= 0) {
                invokeScaleKubernetes(kindName, replicas);
            } else {
                vscode.window.showErrorMessage('Replica count must be a non-negative integer');
            }
        }
    },
    (err) => vscode.window.showErrorMessage(`Error getting scale input: ${err}`));
}

async function invokeScaleKubernetes(kindName: string, replicas: number) {
    const er = await host.longRunning(`Scaling ${kindName} to ${replicas} replicas...`, () =>
        kubectl.invokeCommand(`scale --replicas=${replicas} ${kindName}`)
    );
    await kubectl.reportResult(er, {});
}

function runKubernetes() {
    buildPushThenExec(async (name, image) => {
        const er = await host.longRunning(`Deploying ${image} as ${name}...`, () =>
            kubectl.invokeCommand(`run ${name} --image=${image}`)
        );
        await kubectl.reportResult(er, {});
    });
}

function diagnosePushError(_exitCode: number, error: string): string {
    if (error.includes("denied")) {
        const user = vscode.workspace.getConfiguration().get("vsdocker.imageUser", null);
        if (user) {
            return "Failed pushing the image to remote registry. Try to login to an image registry.";
        } else {
            return "Failed pushing the image to remote registry. Try setting vsdocker.imageUser.";
        }
    }
    return 'Image push failed.';
}

function buildPushThenExec(fn: (name: string, image: string) => void): void {
    findNameAndImage().then((name, image) => {
        vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (p) => {
            try {
                p.report({ message: "Building an image..." });
                const buildTool = getImageBuildTool();
                const buildResult = await shell.exec(await getBuildCommand(image));
                if (buildResult && buildResult.code === 0) {
                    vscode.window.showInformationMessage(image + ' built.');
                    p.report({ message: "Pushing the image..." });
                    const pushResult = await shell.exec(await getPushCommand(image));
                    if (pushResult && pushResult.code === 0) {
                        vscode.window.showInformationMessage(image + ' pushed.');
                        fn(name, image);
                    } else if (!pushResult) {
                        vscode.window.showErrorMessage(`Image push failed; unable to call ${buildTool}.`);
                    } else {
                        const diagnostic = diagnosePushError(pushResult.code, pushResult.stderr);
                        vscode.window.showErrorMessage(`${diagnostic} See Output window for ${buildTool} push error message.`);
                        kubeChannel.showOutput(pushResult.stderr, buildTool);
                    }
                } else if (!buildResult) {
                    vscode.window.showErrorMessage(`Image build failed; unable to call ${buildTool}.`);
                } else {
                    vscode.window.showErrorMessage('Image build failed. See Output window for details.');
                    kubeChannel.showOutput(buildResult.stderr, buildTool);
                    console.log(buildResult.stderr);
                }
            } catch (err) {
                vscode.window.showErrorMessage(err.message);
                kubeChannel.showOutput(`Failed building/pushing an image: ${err}`);
            }
        });
    });
}

export function tryFindKindNameFromEditor(): Errorable<ResourceKindName> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return { succeeded: false, error: ['No open editor']};
    }
    if (editor.document.languageId !== 'yaml' && editor.document.languageId !== 'json') {
        return { succeeded: false, error: ['Not a YAML or JSON document']};
    }
    const text = editor.document.getText();
    return findKindNameForText(text);
}

interface ResourceKindName {
    readonly namespace?: string;
    readonly kind: string;
    readonly resourceName: string;
}

function findKindNameForText(text: string): Errorable<ResourceKindName> {
    const kindNames = findKindNamesForText(text);
    if (!succeeded(kindNames)) {
        return { succeeded: false, error: kindNames.error };
    }
    if (kindNames.result.length > 1) {
        return { succeeded: false, error: ['the open document contains multiple Kubernetes resources'] };
    }
    return { succeeded: true, result: kindNames.result[0] };
}

function findKindNamesForText(text: string): Errorable<ResourceKindName[]> {
    try {
        const objs: {}[] = yaml.safeLoadAll(text);
        if (objs.some((o) => !isKubernetesResource(o))) {
            if (objs.length === 1) {
                return { succeeded: false, error: ['the open document is not a Kubernetes resource'] };
            }
            return { succeeded: false, error: ['the open document contains an item which is not a Kubernetes resource'] };
        }
        const kindNames = objs
            .map((o) => o as KubernetesResource)
            .map((obj) => ({
                kind: obj.kind.toLowerCase(),
                resourceName: obj.metadata.name,
                namespace: obj.metadata.namespace
            }));
        return { succeeded: true, result: kindNames };
    } catch (ex) {
        console.log(ex);
        return { succeeded: false, error: [ ex ] };
    }
}

export async function findKindNameOrPrompt(resourceKinds: kuberesources.ResourceKind[], descriptionVerb: string, opts: vscode.InputBoxOptions & QuickPickKindNameOptions): Promise<string | undefined> {
    const kindObject = tryFindKindNameFromEditor();
    if (failed(kindObject)) {
        return await promptKindName(resourceKinds, descriptionVerb, opts);
    } else {
        return `${kindObject.result.kind}/${kindObject.result.resourceName}`;
    }
}

export async function promptKindName(resourceKinds: kuberesources.ResourceKind[], descriptionVerb: string, opts: vscode.InputBoxOptions & QuickPickKindNameOptions): Promise<string | undefined> {
    let placeHolder: string = 'Empty string to be prompted';
    let prompt: string = `What resource do you want to ${descriptionVerb}?`;

    if (opts) {
        placeHolder = opts.placeHolder || placeHolder;
        prompt = opts.prompt || prompt;
    }

    const resource = await vscode.window.showInputBox({ prompt, placeHolder});

    if (resource === '') {
        return await quickPickKindName(resourceKinds, opts);
    } else if (resource === undefined) {
        return undefined;
    } else {
        return resource;
    }
}

export async function quickPickKindName(resourceKinds: kuberesources.ResourceKind[], opts: QuickPickKindNameOptions): Promise<string | undefined> {
    if (resourceKinds.length === 1) {
        return await quickPickKindNameFromKind(resourceKinds[0], opts);
    }

    const resourceKind = await vscode.window.showQuickPick(resourceKinds);
    if (!resourceKind) {
        return undefined;
    }

    return await quickPickKindNameFromKind(resourceKind, opts);
}

interface QuickPickKindNameOptions {
    readonly filterNames?: string[];
    readonly nameOptional?: boolean;
}

async function quickPickKindNameFromKind(resourceKind: kuberesources.ResourceKind, opts: QuickPickKindNameOptions): Promise<string | undefined> {
    const kind = resourceKind.abbreviation;
    const er = await kubectl.invokeCommand("get " + kind);
    if (ExecResult.failed(er)) {
        await kubectl.reportFailure(er, {});
        return undefined;
    }

    let names = parseNamesFromKubectlLines(er.stdout);
    if (names.length === 0) {
        vscode.window.showInformationMessage(`No resources of type ${resourceKind.displayName} in cluster`);
        return;
    }

    if (opts) {
        names = pullAll(names, opts.filterNames) || names;
    }

    if (opts && opts.nameOptional) {
        names.push('(all)');
        const name = await vscode.window.showQuickPick(names);

        if (name) {
            let kindName;
            if (name === '(all)') {
                kindName = kind;
            } else {
                kindName = `${kind}/${name}`;
            }
            return kindName;
        } else {
            return undefined;
        }
    } else {
        const name = await vscode.window.showQuickPick(names);
        if (name) {
            const kindName = `${kind}/${name}`;
            return kindName;
        } else {
            return undefined;
        }
    }
}

function containsName(kindName: string): boolean {
    if (kindName) {
        return kindName.indexOf('/') > 0;
    }
    return false;
}

function parseNamesFromKubectlLines(text: string): string[] {
    const lines = text.split('\n');
    lines.shift();

    const names = lines.filter((line) => {
        return line.length > 0;
    }).map((line) => {
        return parseName(line);
    });

    return names;
}

function parseName(line: string): string {
    return line.split(' ')[0];
}

async function getContainers(resource: ContainerContainer): Promise<Container[] | undefined> {
    const q = shell.isWindows() ? `'` : `"`;
    const lit = (l: string) => `{${q}${l}${q}}`;
    const query = `${lit("NAME\\tIMAGE\\n")}{range ${resource.containersQueryPath}.containers[*]}{.name}${lit("\\t")}{.image}${lit("\\n")}{end}`;
    const queryArg = shell.isWindows() ? `"${query}"` : `'${query}'`;
    let cmd = `get ${resource.kindName} -o jsonpath=${queryArg}`;
    if (resource.namespace && resource.namespace.length > 0) {
        cmd += ' --namespace=' + resource.namespace;
    }
    const containers = await kubectl.asLines(cmd);
    if (failed(containers)) {
        vscode.window.showErrorMessage("Failed to get containers in resource: " + containers.error[0]);
        return undefined;
    }

    const containersEx = containers.result.map((s) => {
        const bits = s.split('\t');
        return { name: bits[0], image: bits[1] };
    });

    return containersEx;
}

enum PodSelectionFallback {
    None,
    AnyPod,
}

enum PodSelectionScope {
    App,
    All,
}

async function selectPod(scope: PodSelectionScope, fallback: PodSelectionFallback): Promise<Pod | null> {
    const findPodsResult = scope === PodSelectionScope.App ? await findPodsForApp() : await findAllPods();

    if (!findPodsResult.succeeded) {
        return null;
    }

    const podList = findPodsResult.pods;

    if (podList.length === 0) {
        if (fallback === PodSelectionFallback.AnyPod) {
            return selectPod(PodSelectionScope.All, PodSelectionFallback.None);
        }
        const scopeMessage = scope === PodSelectionScope.App ? "associated with this app" : "in the cluster";
        vscode.window.showErrorMessage(`Couldn't find any pods ${scopeMessage}.`);
        return null;
    }

    if (podList.length === 1) {
        return podList[0];
    }

    const pickItems = podList.map((element) => { return {
        label: `${element.metadata.namespace || "default"}/${element.metadata.name}`,
        description: '',
        pod: element
    }; });

    const value = await vscode.window.showQuickPick(pickItems);

    if (!value) {
        return null;
    }

    return value.pod;
}

function getPorts() {
    const file = vscode.workspace.rootPath + '/Dockerfile';
    if (!fs.existsSync(file)) {
        return null;
    }
    try {
        const data = fs.readFileSync(file, 'utf-8');
        const obj = dockerfileParse(data);
        return obj.expose;
    } catch (ex) {
        console.log(ex);
        return null;
    }
}

async function describeKubernetes(explorerNode?: ClusterExplorerResourceNode) {
    let ns: string | null, value: string | undefined;
    if (explorerNode) {
        ns = explorerNode.namespace ? explorerNode.namespace : '';
        value = explorerNode.kindName;
    } else {
        ns = null;
        value = await findKindNameOrPrompt(kuberesources.commonKinds, 'describe', { nameOptional: true });
    }

    if (!value) {
        return;
    }
    const uri = kubefsUri(ns, value, '', 'describe');
    vscode.workspace.openTextDocument(uri).then((doc) => {
        if (doc) {
            vscode.window.showTextDocument(doc);
        }
    },
    (err) => vscode.window.showErrorMessage(`Error loading document: ${err}`));
}

async function refreshDescribeKubernetes(resourceDocProvider: KubernetesResourceVirtualFileSystemProvider) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const uri = editor.document.uri;
        if (uri.authority === KUBECTL_DESCRIBE_AUTHORITY) {
            const newContent = await resourceDocProvider.loadResource(uri);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(
                uri,
                new vscode.Range(0, 0, editor.document.lineCount, 0),
                newContent);
            vscode.workspace.applyEdit(edit);
        }
    }
}

export interface PodSummary {
    readonly name: string;
    readonly namespace: string | undefined;
    readonly spec?: {
        containers?: Container[];
    };
}

function summary(pod: Pod): PodSummary {
    return {
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
        spec: pod.spec
    };
}

export async function selectContainerForPod(pod: PodSummary): Promise<Container | null> {
    const resource = ContainerContainer.fromPod(pod);
    return selectContainerForResource(resource);
}

export async function selectContainerForResource(resource: ContainerContainer): Promise<Container | null> {
    if (!resource) {
        return null;
    }

    const containers = (resource.containers) ? resource.containers : await getContainers(resource);

    if (!containers) {
        return null;
    }

    if (containers.length === 1) {
        return containers[0];
    }

    const pickItems = containers.map((element) => { return {
        label: element.name,
        description: '',
        detail: element.image,
        container: element
    }; });

    const value = await vscode.window.showQuickPick(pickItems, { placeHolder: "Select container" });

    if (!value) {
        return null;
    }

    return value.container;
}

function execKubernetes() {
    execKubernetesCore(false);
}

async function terminalKubernetes(explorerNode?: ClusterExplorerResourceNode) {
    if (explorerNode) {
        const namespace = explorerNode.namespace;
        const podSummary = { name: explorerNode.name, namespace: namespace || undefined };  // TODO: rationalise null and undefined
        const container = await selectContainerForPod(podSummary);
        if (container) {
            // For those images (e.g. built from Busybox) where bash may not be installed by default, use sh instead.
            const suggestedShell = await suggestedShellForContainer(kubectl, podSummary.name, podSummary.namespace, container.name);
            execTerminalOnContainer(podSummary.name, podSummary.namespace, container.name, suggestedShell);
        }
    } else {
        execKubernetesCore(true);
    }
}

async function execKubernetesCore(isTerminal: boolean): Promise<void> {
    const opts: any = { prompt: 'Please provide a command to execute' };

    if (isTerminal) {
        opts.value = 'bash';
    }

    const cmd = await vscode.window.showInputBox(opts);

    if (!cmd || cmd.length === 0) {
        return;
    }

    const pod = await selectPod(PodSelectionScope.App, PodSelectionFallback.AnyPod);

    if (!pod || !pod.metadata) {
        return;
    }

    const container = await selectContainerForPod(summary(pod));

    if (!container) {
        return;
    }

    if (isTerminal) {
        execTerminalOnContainer(pod.metadata.name, pod.metadata.namespace, container.name, cmd);
        return;
    }

    const execCmd = `exec ${pod.metadata.name} -c ${container.name} -- ${cmd}`;
    kubectl.invokeInSharedTerminal(execCmd);
}

function execTerminalOnContainer(podName: string, podNamespace: string | undefined, containerName: string | undefined, terminalCmd: string) {
    const terminalExecCmd: string[] = ['exec', '-it', podName];
    if (podNamespace) {
        terminalExecCmd.push('--namespace', podNamespace);
    }
    if (containerName) {
        terminalExecCmd.push('--container', containerName);
    }
    terminalExecCmd.push('--', terminalCmd);
    const terminalName = `${terminalCmd} on ${podName}` + (containerName ? `/${containerName}`: '');
    kubectl.runAsTerminal(terminalExecCmd, terminalName);
}

async function syncKubernetes(): Promise<void> {
    const pod = await selectPod(PodSelectionScope.App, PodSelectionFallback.None);
    if (!pod) {
        return;
    }

    const container = await selectContainerForPod(summary(pod));
    if (!container) {
        return;
    }

    const pieces = container.image.split(':');
    if (pieces.length !== 2) {
        vscode.window.showErrorMessage(`Sync requires image tag to have a version which is a Git commit ID. Actual image tag was ${container.image}`);
        return;
    }

    const commitId = pieces[1];
    const whenCreated = await git.whenCreated(commitId);
    const versionMessage = whenCreated ?
        `The Git commit deployed to the cluster is  ${commitId} (created ${whenCreated.trim()} ago). This will check out that commit.` :
        `The image version deployed to the cluster is ${commitId}. This will look for a Git commit with that name/ID and check it out.`;

    const choice = await vscode.window.showInformationMessage(versionMessage, 'OK');

    if (choice === 'OK') {
        const checkoutResult = await git.checkout(commitId);

        if (failed(checkoutResult)) {
            vscode.window.showErrorMessage(`Error checking out commit ${commitId}: ${checkoutResult.error[0]}`);
        }
    }
}

async function reportDeleteResult(resourceId: string, execResult: ExecResult) {
    const successInfo = await kubectl.reportResult(execResult, { whatFailed: `Failed to delete resource '${resourceId}'` });
    if (successInfo) {
        refreshExplorer();
    }
}

async function deleteKubernetes(delMode: KubernetesDeleteMode, explorerNode?: ClusterExplorerResourceNode) {

    const delModeArg = delMode ===  KubernetesDeleteMode.Now ? ' --now' : '';

    if (explorerNode) {
        const answer = await vscode.window.showWarningMessage(`Do you want to delete the resource '${explorerNode.kindName}'?`, ...deleteMessageItems);
        if (!answer || answer.isCloseAffordance) {
            return;
        }

        if (explorerNode.kind.manifestKind === 'Namespace') {
            const ns = explorerNode.name;
            const confirmed = await confirmDangerousNamespaceDeletion(ns);
            if (!confirmed) {
                return;
            }
            const currentNS = await kubectlUtils.currentNamespace(kubectl);
            if (ns === currentNS) {
                await host.longRunning(`Switching out of namespace '${ns}'`, () =>
                    kubectlUtils.switchNamespace(kubectl, "default")
                );
            }
        }
        const nsarg = explorerNode.namespace ? `--namespace ${explorerNode.namespace}` : '';
        const execResult = await kubectl.invokeCommandWithFeedback(`delete ${explorerNode.kindName} ${nsarg} ${delModeArg}`, `Deleting ${explorerNode.kindName}...`);
        await reportDeleteResult(explorerNode.kindName, execResult);
    } else {
        const kindName = await promptKindName(kuberesources.commonKinds, 'delete', { nameOptional: true });
        if (kindName) {
            let commandArgs = kindName;
            if (!containsName(kindName)) {
                commandArgs = kindName + " --all";
            }
            const execResult = await kubectl.invokeCommandWithFeedback(`delete ${commandArgs} ${delModeArg}`, `Deleting ${kindName}...`);
            await reportDeleteResult(kindName, execResult);
        }
    }
}

async function confirmDangerousNamespaceDeletion(ns: string): Promise<boolean> {
    if (ns === 'default') {
        const confirmed = await warnConfirm("This will delete the default namespace, which is inadvisable.", "I'm aware of the risks: delete anyway", "Don't delete");
        if (!confirmed) {
            return false;
        }
    }

    const resources = await host.longRunning(`Checking contents of namespace '${ns}'`, () =>
        kubectlUtils.namespaceResources(kubectl, ns)
    );
    if (succeeded(resources)) {
        if (resources.result.length > 0) {
            const confirmed = await warnConfirm(`This will also delete all ${resources.result.length} resources in namespace '${ns}'.`, "I don't need them: delete anyway", "Don't delete");
            if (!confirmed) {
                return false;
            }
        }
    } else {
        const confirmed = await warnConfirm(`Can't check if namespace '${ns}' contains resources: ${resources.error[0]}.`, "I'm sure it's safe: delete anyway", "Don't delete");
        if (!confirmed) {
            return false;
        }
    }

    return true;
}

async function warnConfirm(message: string, acceptText: string, cancelText: string): Promise<boolean> {
    const choice = await vscode.window.showWarningMessage(message, acceptText, cancelText);
    if (!choice || choice === cancelText) {
        return false;
    }
    return true;
}

enum KubernetesDeleteMode {
    Graceful,
    Now
}

enum DiffResultKind {
    Succeeded,
    NoEditor,
    NoKindName,
    NoClusterResource,
    GetFailed,
    NothingToDiff,
}

interface DiffResult {
    readonly result: DiffResultKind;
    readonly resourceName?: string;
    readonly stderr?: string;
    readonly reason?: string;
}

async function confirmOperation(prompt: (msg: string, ...opts: string[]) => Thenable<string>, message: string, confirmVerb: string, operation: () => void): Promise<void> {
    const result = await prompt(message, confirmVerb);
    if (result === confirmVerb) {
        operation();
    }
}

const applyKubernetes = () => {
    diffKubernetesCore((r) => {
        switch (r.result) {
            case DiffResultKind.Succeeded:
                confirmOperation(
                    vscode.window.showInformationMessage,
                    'Do you wish to apply this change?',
                    'Apply',
                    () => maybeRunKubernetesCommandForActiveWindow('apply', "Kubernetes Applying...")
                );
                return;
            case DiffResultKind.NoEditor:
                vscode.window.showErrorMessage("No active editor - the Apply command requires an open document");
                return;
            case DiffResultKind.NoKindName:
                confirmOperation(
                    vscode.window.showWarningMessage,
                    `Can't show what changes will be applied (${r.reason}). Apply anyway?`,
                    'Apply',
                    () => maybeRunKubernetesCommandForActiveWindow('apply', "Kubernetes Applying...")
                );
                return;
            case DiffResultKind.NoClusterResource:
                confirmOperation(
                    vscode.window.showWarningMessage,
                    `Resource ${r.resourceName} does not exist - this will create a new resource.`,
                    'Create',
                    () => maybeRunKubernetesCommandForActiveWindow('create', "Kubernetes Creating...")
                );
                return;
            case DiffResultKind.GetFailed:
                confirmOperation(
                    vscode.window.showWarningMessage,
                    `Can't show what changes will be applied - error getting existing resource (${r.stderr}). Apply anyway?`,
                    'Apply',
                    () => maybeRunKubernetesCommandForActiveWindow('apply', "Kubernetes Applying...")
                );
                return;
            case DiffResultKind.NothingToDiff:
                vscode.window.showInformationMessage("Nothing to apply");
                return;
        }
    });
};

const handleError = (err: NodeJS.ErrnoException) => {
    if (err) {
        vscode.window.showErrorMessage(err.message);
    }
};

function diffKubernetes(): void {
    diffKubernetesCore((r) => {
        switch (r.result) {
            case DiffResultKind.Succeeded:
                return;
            case DiffResultKind.NoEditor:
                vscode.window.showErrorMessage("No active editor - the Diff command requires an open document");
                return;
            case DiffResultKind.NoKindName:
                vscode.window.showErrorMessage(`Can't diff - ${r.reason}`);
                return;
            case DiffResultKind.NoClusterResource:
                vscode.window.showInformationMessage(`Can't diff - ${r.resourceName} doesn't exist in the cluster`);
                return;
            case DiffResultKind.GetFailed:
                vscode.window.showErrorMessage(`Can't diff - error getting existing resource: ${r.stderr}`);
                return;
            case DiffResultKind.NothingToDiff:
                vscode.window.showInformationMessage("Nothing to diff");
                return;
        }

    });
}

function diffKubernetesCore(callback: (r: DiffResult) => void): void {
    getTextForActiveWindow((data, file) => {
        console.log(data, file);
        let kindName: string | null = null;
        let kindObject: Errorable<ResourceKindName> | undefined = undefined;
        let fileUri: vscode.Uri | null = null;

        let fileFormat = "json";

        if (data) {
            fileFormat = (data.trim().length > 0 && data.trim()[0] === '{') ? "json" : "yaml";
            kindObject = findKindNameForText(data);
            if (failed(kindObject)) {
                callback({ result: DiffResultKind.NoKindName, reason: kindObject.error[0] });
                return;
            }
            kindName = `${kindObject.result.kind}/${kindObject.result.resourceName}`;
            const filePath = path.join(os.tmpdir(), `local.${fileFormat}`);
            fs.writeFile(filePath, data, handleError);
            fileUri = shell.fileUri(filePath);
        } else if (file) {
            if (!vscode.window.activeTextEditor) {
                callback({ result: DiffResultKind.NoEditor });
                return; // No open text editor
            }
            kindObject = tryFindKindNameFromEditor();
            if (failed(kindObject)) {
                callback({ result: DiffResultKind.NoKindName, reason: kindObject.error[0] });
                return;
            }
            kindName = `${kindObject.result.kind}/${kindObject.result.resourceName}`;
            fileUri = file;
            if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
                const langId = vscode.window.activeTextEditor.document.languageId.toLowerCase();
                if (langId === "yaml" || langId === "helm") {
                    fileFormat = "yaml";
                }
            }
        } else {
            callback({ result: DiffResultKind.NothingToDiff });
            return;
        }

        if (!kindName) {
            callback({ result: DiffResultKind.NoKindName, reason: 'Could not find a valid API object' });
            return;
        }

        kubectl.invokeCommandThen(` get -o ${fileFormat} ${kindName}`, (er) => {
            if (er.resultKind === 'exec-errored' && er.code === 1 && er.stderr.indexOf('NotFound') >= 0) {
                callback({ result: DiffResultKind.NoClusterResource, resourceName: kindName || undefined });  // TODO: rationalise our nulls and undefineds
                return;
            }
            else if (er.resultKind !== 'exec-succeeded') {
                callback({ result: DiffResultKind.GetFailed, stderr: ExecResult.failureMessage(er, {}) });
                return;
            }

            const serverFile = path.join(os.tmpdir(), `server.${fileFormat}`);
            fs.writeFile(serverFile, er.stdout, handleError);

            vscode.commands.executeCommand(
                'vscode.diff',
                shell.fileUri(serverFile),
                fileUri).then((result) => {
                    console.log(result);
                    callback({ result: DiffResultKind.Succeeded });
                },
                (err) => vscode.window.showErrorMessage(`Error running command: ${err}`));
        });
    });
}

const debugKubernetes = async () => {
    const workspaceFolder = await showWorkspaceFolderPick();
    if (workspaceFolder) {
        const legacySupportedDebuggers = ["node"]; // legacy code support node debugging.
        const providerSupportedDebuggers = getSupportedDebuggerTypes();
        const supportedDebuggers = providerSupportedDebuggers.concat(legacySupportedDebuggers);
        const debuggerType = await vscode.window.showQuickPick(supportedDebuggers, {
            placeHolder: "Select the environment"
        });

        if (!debuggerType) {
            return;
        }

        const debugProvider = getDebugProviderOfType(debuggerType);
        if (debugProvider) {
            new DebugSession(kubectl).launch(workspaceFolder, debugProvider);
        } else {
            buildPushThenExec(debugInternal);
        }
    }
};

const debugAttachKubernetes = async (explorerNode: ClusterExplorerResourceNode) => {
    const workspaceFolder = await showWorkspaceFolderPick();
    if (workspaceFolder) {
        new DebugSession(kubectl).attach(workspaceFolder, explorerNode ? explorerNode.name : undefined, explorerNode ? explorerNode.namespace || undefined : undefined);  // TODO: rationalise the nulls and undefineds
    }
};

const debugInternal = (name: string, image: string) => {
    // TODO: optionalize/customize the '-debug'
    // TODO: make this smarter.
    vscode.window.showInputBox({
        prompt: 'Debug command for your container:',
        placeHolder: 'Example: node debug server.js' }
    ).then((cmd) => {
        if (!cmd) {
            return;
        }

        doDebug(name, image, cmd);
    },
    (err) => vscode.window.showErrorMessage(`Error getting input: ${err}`));
};

const doDebug = async (name: string, image: string, cmd: string) => {
    const deploymentName = `${name}-debug`;
    const runCmd = `run ${deploymentName} --image=${image} -i --attach=false -- ${cmd}`;
    console.log(runCmd);

    const er = await kubectl.invokeCommand(runCmd);
    if (ExecResult.failed(er)) {
        await kubectl.reportFailure(er, { whatFailed: 'Failed to start debug container'});
        return;
    }

    const findPodsResult = await findDebugPodsForApp();

    if (!findPodsResult.succeeded) {
        return;
    }

    const podList = findPodsResult.pods;

    if (podList.length === 0) {
        vscode.window.showErrorMessage('Failed to find debug pod.');
        return;
    }

    const podName = podList[0].metadata.name;
    vscode.window.showInformationMessage('Debug pod running as: ' + podName);

    waitForRunningPod(podName, async () => {
        const pfer = await kubectl.invokeCommand(` port-forward ${podName} 5858:5858 8000:8000`);
        const pfsucc = await kubectl.reportResult(pfer, {});

        if (!pfsucc) {
            return;
        }

        const debugConfiguration = {
            type: 'node',
            request: 'attach',
            name: 'Attach to Process',
            port: 5858,
            localRoot: vscode.workspace.rootPath,
            remoteRoot: '/'
        };

        vscode.debug.startDebugging(
            undefined,
            debugConfiguration
        ).then(() => {
            vscode.window.showInformationMessage('Debug session established', 'Expose Service').then((opt) => {
                if (opt !== 'Expose Service') {
                    return;
                }

                vscode.window.showInputBox({ prompt: 'Expose on which port?', placeHolder: '80' }).then((port) => {
                    if (!port) {
                        return;
                    }

                    const exposeCmd = `expose deployment ${deploymentName} --type=LoadBalancer --port=${port}`;
                    kubectl.invokeCommandThen(exposeCmd, (eer) => {
                        if (eer.resultKind !== 'exec-succeeded') {
                            vscode.window.showErrorMessage('Failed to expose deployment: ' + ExecResult.failureMessage(eer, {}));
                            return;
                        }
                        vscode.window.showInformationMessage(`Deployment exposed. Run Kubernetes Get > service ${deploymentName} for IP address`);
                    });
                });
            },
            (err) => vscode.window.showErrorMessage(`Error getting port info: ${err}`));
        }, (err) => vscode.window.showErrorMessage(`Error getting expose info: ${err.message}`));
    });
};

const waitForRunningPod = (name: string, callback: () => void) => {
    kubectl.invokeCommandThen(` get pods ${name} -o jsonpath --template="{.status.phase}"`,
        async (er) => {
            const succ = await kubectl.reportResult(er, {});
            if (!succ) {
                return;
            }

            if (succ.stdout === 'Running') {
                callback();
                return;
            }

            setTimeout(() => waitForRunningPod(name, callback), 1000);
        });
};

function exists(kind: string, name: string, handler: (exists: boolean) => void) {
    kubectl.invokeCommandThen(`get ${kind} ${name}`, (er) => {
        handler(er.resultKind === 'exec-succeeded');
    });
}

function deploymentExists(deploymentName: string, handler: (exists: boolean) => void) {
    exists('deployments', deploymentName, handler);
}

function serviceExists(serviceName: string, handler: (exists: boolean) => void) {
    exists('services', serviceName, handler);
}

function removeDebugKubernetes() {
    findNameAndImage().then((name, _image) => {
        const deploymentName = name + '-debug';
        deploymentExists(deploymentName, (deployment) => {
            serviceExists(deploymentName, (service) => {
                if (!deployment && !service) {
                    vscode.window.showInformationMessage(deploymentName + ': nothing to clean up');
                    return;
                }

                const toDelete = deployment ? ('deployment' + (service ? ' and service' : '')) : 'service';
                vscode.window.showWarningMessage(`This will delete ${toDelete} ${deploymentName}`, 'Delete').then((opt) => {
                    if (opt !== 'Delete') {
                        return;
                    }

                    if (service) {
                        kubectl.invokeCommandThen('delete service ' + deploymentName, (er) => kubectl.reportResult(er, {}));
                    }

                    if (deployment) {
                        kubectl.invokeCommandThen('delete deployment ' + deploymentName, (er) => kubectl.reportResult(er, {}));
                    }
                },
                (err) => vscode.window.showErrorMessage(`Error getting confirmation of delete: ${err}`));
            });
        });
    });
}

// There is a possible race condition if this extension and another
// extension both activate in response to the same command - the other
// extension does not get the chance to intervene in the command
// until after our internal state has settled by when it is too late.
// (See issue raised at https://github.com/Microsoft/vscode/issues/71471.)
//
// It seems we can work around this by forcing VS Code to pump a
// command before we dive into whatever we want to do.  This little
// kludge does that.
let needsActivationDebouncing = true;

async function debounceActivation(): Promise<void> {
    if (needsActivationDebouncing) {
        await sleep(50);
        await vscode.commands.executeCommand('extension.vsKubernetesDebounceActivation');
        needsActivationDebouncing = false;
    }
}

async function configureFromClusterKubernetes() {
    await debounceActivation();
    runClusterWizard('Add Existing Cluster', 'configure');
}

async function createClusterKubernetes() {
    await debounceActivation();
    runClusterWizard('Create Kubernetes Cluster', 'create');
}

const ADD_NEW_KUBECONFIG_PICK = "+ Add new kubeconfig";

async function useKubeconfigKubernetes(kubeconfig?: string | { isTrusted: boolean } /* TODO: remove when VS Code fixed */): Promise<void> {
    // TODO: remove when VS Code fixed - workaround for https://github.com/microsoft/vscode/issues/94872
    function fix94872(kubeconfig?: string | { isTrusted: boolean }): string | undefined {
        function isBuggyThing(o: string | undefined | { isTrusted: boolean }): o is { isTrusted: boolean } {
            return !!o && ((o as any).isTrusted !== undefined);
        }
        if (isBuggyThing(kubeconfig)) {
            return undefined;
        }
        return kubeconfig;
    }

    const kc = await getKubeconfigSelection(fix94872(kubeconfig));
    if (!kc) {
        return;
    }
    await setActiveKubeconfig(kc);
    telemetry.invalidateClusterType(undefined, kubectl);
}

async function getKubeconfigSelection(kubeconfig?: string): Promise<string | undefined> {
    if (kubeconfig) {
        return kubeconfig;
    }
    const knownKubeconfigs = getKnownKubeconfigs();
    const picks = [ ADD_NEW_KUBECONFIG_PICK, ...knownKubeconfigs ];
    const pick = await vscode.window.showQuickPick(picks);

    if (pick === ADD_NEW_KUBECONFIG_PICK) {
        const kubeconfigUris = await vscode.window.showOpenDialog({});
        if (kubeconfigUris && kubeconfigUris.length === 1) {
            const kubeconfigPath = kubeconfigUris[0].fsPath;
            await addKnownKubeconfig(kubeconfigPath);
            return kubeconfigPath;
        }
        return undefined;
    }

    return pick;
}

async function useContextKubernetes(explorerNode: ClusterExplorerNode) {
    if (explorerNode && explorerNode.nodeType === explorer.NODE_TYPES.context) {
        const contextObj = explorerNode.kubectlContext;
        const targetContext = contextObj.contextName;
        setContextKubernetes(targetContext);
        return;
    }

    const contexts = await kubectlUtils.getContexts(kubectl, { silent: false });  // TODO: turn it silent, cascade errors, and provide an error node
    const inactiveContexts = contexts.filter((context) => !context.active).map((context) => context.contextName);
    const selected = await vscode.window.showQuickPick(inactiveContexts, { placeHolder: 'Pick the context you want to switch to' });
    if (selected) {
        setContextKubernetes(selected);
    }
}

async function setContextKubernetes(targetContext: string) {
    const er = await kubectl.invokeCommand(`config use-context ${targetContext}`);
    if (ExecResult.succeeded(er)) {
        telemetry.invalidateClusterType(targetContext);
        activeContextTracker.setActive(targetContext);
        refreshExplorer();
        WatchManager.instance().clear();
    } else {
        kubectl.reportFailure(er, { whatFailed: `Failed to set '${targetContext}' as current cluster` });
    }
}

async function clusterInfoKubernetes(_explorerNode: ClusterExplorerNode) {
    // If a node is passed, it's always the active cluster so we don't need to use the argument
    kubectl.invokeInSharedTerminal("cluster-info");
}

async function deleteContextKubernetes(explorerNode: ClusterExplorerNode) {
    if (!explorerNode || explorerNode.nodeType !== explorer.NODE_TYPES.context) {
        return;
    }
    const contextObj = explorerNode.kubectlContext;
    const answer = await vscode.window.showWarningMessage(`Do you want to delete the cluster '${contextObj.contextName}' from the kubeconfig?`, ...deleteMessageItems);
    if (!answer || answer.isCloseAffordance) {
        return;
    }
    if (await kubectlUtils.deleteCluster(kubectl, contextObj)) {
        refreshExplorer();
    }
}

async function copyKubernetes(explorerNode: ClusterExplorerNode) {
    const name = copiableName(explorerNode);
    if (name) {
        clipboard.write(name);
    }
}

function copiableName(explorerNode: ClusterExplorerNode): string | undefined {
    switch (explorerNode.nodeType) {
        case explorer.NODE_TYPES.context: return explorerNode.contextName;
        case explorer.NODE_TYPES.resource: return explorerNode.name;
        case explorer.NODE_TYPES.helm.release: return explorerNode.releaseName;
        case explorer.NODE_TYPES.configitem: return explorerNode.key;
        default: return undefined;
    }
}

async function execDraftVersion() {
    if (!(await draft.checkPresent(DraftCheckPresentMode.Alert))) {
        return;
    }

    const dvResult = await draft.version();

    if (succeeded(dvResult)) {
        host.showInformationMessage(dvResult.result);
    } else if (dvResult.error[0]) {
        host.showErrorMessage(dvResult.error[0]);
    }
}

async function execDraftCreate() {
    if (vscode.workspace.rootPath === undefined) {
        vscode.window.showErrorMessage('This command requires an open folder.');
        return;
    }
    if (draft.isFolderMapped(vscode.workspace.rootPath)) {
        vscode.window.showInformationMessage('This folder is already configured for draft. Run draft up to deploy.');
        return;
    }
    if (!(await draft.checkPresent(DraftCheckPresentMode.Alert))) {
        return;
    }
    const proposedAppName = path.basename(vscode.workspace.rootPath);
    const appName = await vscode.window.showInputBox({ value: proposedAppName, prompt: "Choose a name for the Helm release"});
    if (appName) {
        await execDraftCreateApp(appName, undefined);
    }
}

enum DraftCreateResult {
    Succeeded,
    Fatal,
    NeedsPack,
}

async function execDraftCreateApp(appName: string, pack?: string): Promise<void> {
    const folder = await showWorkspaceFolderPick();
    if (!folder) {
        return;
    }

    const dcResult = await draft.create(appName, pack, folder.uri.fsPath);
    if (!dcResult) {
        host.showErrorMessage(`Unable to run Draft`);
        return;
    }

    switch (draftCreateResult(dcResult, !!pack)) {
        case DraftCreateResult.Succeeded:
            host.showInformationMessage("draft " + dcResult.stdout);
            return;
        case DraftCreateResult.Fatal:
            host.showErrorMessage(`draft failed: ${dcResult.stderr}`);
            return;
        case DraftCreateResult.NeedsPack:
            const packs = await draft.packs();
            if (packs && packs.length > 0) {
                const packSel = await host.showQuickPick(packs, { placeHolder: `Choose the Draft starter pack for ${appName}` });
                if (packSel) {
                    await execDraftCreateApp(appName, packSel);
                }
            } else {
                host.showErrorMessage("Unable to determine starter pack, and no starter packs found to choose from.");
            }
            return;
    }
}

function draftCreateResult(sr: ShellResult, hadPack: boolean) {
    if (sr.code === 0) {
        return DraftCreateResult.Succeeded;
    }
    if (!hadPack && draftErrorMightBeSolvedByChoosingPack(sr.stderr)) {
        return DraftCreateResult.NeedsPack;
    }
    return DraftCreateResult.Fatal;
}

function draftErrorMightBeSolvedByChoosingPack(draftError: string) {
    return draftError.indexOf('Unable to select a starter pack') >= 0
        || draftError.indexOf('Error: no languages were detected') >= 0;
}

async function execDraftUp() {
    if (vscode.workspace.rootPath === undefined) {
        vscode.window.showErrorMessage('This command requires an open folder.');
        return;
    }
    if (!draft.isFolderMapped(vscode.workspace.rootPath)) {
        vscode.window.showInformationMessage('This folder is not configured for draft. Run draft create to configure it.');
        return;
    }

    await draft.up();
}

async function helmConvertToTemplate(arg?: any) {
    const workspace = await showWorkspaceFolderPick();
    if (!workspace) {
        return;
    }
    helmauthoring.convertToTemplate(fs, host, workspace.uri.fsPath, arg);
}

async function helmParameterise() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return;
    }

    const document = activeEditor.document;
    if (!document) {
        return;
    }

    const selection = activeEditor.selection;
    if (!selection) {
        return;
    }

    const convertResult = await helmauthoring.convertToParameter(fs, host, document, selection);

    if (succeeded(convertResult)) {
        const editor = await vscode.window.showTextDocument(convertResult.result.document);
        const edit = convertResult.result.edit;
        editor.revealRange(edit.range);
        editor.selection = new vscode.Selection(edit.range.start, edit.range.end);  // TODO: this isn't quite right because it gives us the insert-at selection not the resultant edit
    } else {
        vscode.window.showErrorMessage(convertResult.error[0]);
    }
}

function isLintable(document: vscode.TextDocument): boolean {
    return document.languageId === 'yaml' || document.languageId === 'json' || document.languageId === 'helm';
}

function linterDisabled(disabledLinters: string[], name: string): boolean {
    return (disabledLinters || []).some((l) => l === name);
}

async function kubernetesLint(document: vscode.TextDocument): Promise<void> {
    if (config.getDisableLint()) {
        return;
    }
    // Is it a Kubernetes document?
    if (!isLintable(document)) {
        return;
    }
    const disabledLinters = config.getDisabledLinters();
    const linterPromises =
        linters
            .filter((l) => !linterDisabled(disabledLinters, l.name()))
            .map((l) => l.lint(document));
    const linterResults = await Promise.all(linterPromises);
    const diagnostics = ([] as vscode.Diagnostic[]).concat(...linterResults);
    kubernetesDiagnostics.set(document.uri, diagnostics);
}

async function cronJobRunNow(target?: any): Promise<void> {
    const name = await resourceNameFromTarget(target, 'CronJob to run now');
    if (!name) {
        return;
    }

    const proposedJobName = `${name}-${timestampText()}`;
    const jobName = await vscode.window.showInputBox({ prompt: "Choose a name for the job", value: proposedJobName });
    if (!jobName) {
        return;
    }

    const nsarg = await kubectlUtils.currentNamespaceArg(kubectl);
    const er = await kubectl.invokeCommand(`create job ${jobName} ${nsarg} --from=cronjob/${name}`);

    if (ExecResult.failed(er)) {
        kubectl.reportFailure(er, { whatFailed: 'Error creating job' });
        return;
    }

    vscode.window.showInformationMessage(`Created job ${jobName}`);  // TODO: consider adding button to open logs or something
}

async function resourceNameFromTarget(target: string | ClusterExplorerResourceNode | undefined, pickPrompt: string): Promise<string | undefined> {
    if (!target) {
        // TODO: consider if we have a suitable resource open
        const resourceKind = kuberesources.allKinds['cronjob'];
        return await pickResourceName(resourceKind, pickPrompt);
    }

    if (explorer.isKubernetesExplorerResourceNode(target)) {
        return target.name;
    }

    return target;
}

async function pickResourceName(resourceKind: kuberesources.ResourceKind, prompt: string): Promise<string | undefined> {
    const er = await kubectl.invokeCommand(`get ${resourceKind.abbreviation}`);
    if (ExecResult.failed(er)) {
        await kubectl.reportFailure(er, { whatFailed: `Unable to list resources of type ${resourceKind.displayName}` });
        return undefined;
    }

    const names = parseNamesFromKubectlLines(er.stdout);
    if (names.length === 0) {
        vscode.window.showInformationMessage(`No resources of type ${resourceKind.displayName} in cluster`);
        return undefined;
    }

    const result = await vscode.window.showQuickPick(names, { placeHolder: prompt });
    return result;
}

async function kubernetesMergeIntoKubeconfig(target?: CloudExplorerTreeNode): Promise<void> {
    const newConfigText = await kubeconfigFromTreeNode(target);
    if (!newConfigText) {
        return;
    }

    await mergeToKubeconfig(newConfigText);
}

async function kubernetesSaveKubeconfig(target?: CloudExplorerTreeNode): Promise<void> {
    const newConfigText = await kubeconfigFromTreeNode(target);
    if (!newConfigText) {
        return;
    }
    const kubeconfigFile = await vscode.window.showSaveDialog({});
    if (!kubeconfigFile) {
        return;
    }
    if (kubeconfigFile.scheme !== 'file') {
        vscode.window.showErrorMessage('Can only save to the file system');
        return;
    }

    const kcfile = kubeconfigFile.fsPath;
    if (await fs.existsAsync(kcfile)) {
        vscode.window.showErrorMessage('File already exists');  // TODO: offer overwrite option
        return;
    }

    await fs.writeTextFile(kubeconfigFile.fsPath, newConfigText);
    // TODO: add to known kubeconfigs array in settings?
    vscode.window.showInformationMessage(`Configuration saved to ${kcfile}`);
}

async function kubeconfigFromTreeNode(target?: CloudExplorerTreeNode): Promise<string | undefined> {
    if (!target || target.nodeType !== 'contributed') {
        await vscode.window.showErrorMessage('This command requires a cluster to be selected in Cloud Explorer');
        return undefined;
    }
    const kubeconfigYaml = await target.provider.getKubeconfigYaml(target.value);
    return kubeconfigYaml;
}

async function showInfoMessage(message: string) {
    await vscode.window.showInformationMessage(message);
}

function kubernetesFindCloudProviders() {
    const searchUrl = 'https://marketplace.visualstudio.com/search?term=kubernetes-extension-cloud-provider&target=VSCode&category=All%20categories&sortBy=Relevance';
    browser.open(searchUrl);
}

function updateStatusBarItem(statusBarItem: vscode.StatusBarItem, text: string, tooltip: string, show: boolean): void {
    statusBarItem.text = text;
    statusBarItem.tooltip = tooltip;
	if (show) {
		statusBarItem.show();
	} else {
		statusBarItem.hide();
	}
}
