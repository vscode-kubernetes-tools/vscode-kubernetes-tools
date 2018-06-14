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
import * as dockerfileParse from 'dockerfile-parse';
import * as tmp from 'tmp';
import * as uuid from 'uuid';
import * as clipboard from 'clipboardy';

// Internal dependencies
import { host } from './host';
import { loadConfigMapData, addKubernetesConfigFile, deleteKubernetesConfigFile } from './configMap';
import * as explainer from './explainer';
import { shell, Shell, ShellResult, ShellHandler } from './shell';
import * as configmaps from './configMap';
import * as configureFromCluster from './configurefromcluster';
import * as createCluster from './createcluster';
import * as kuberesources from './kuberesources';
import * as docker from './docker';
import { kubeChannel } from './kubeChannel';
import * as kubeconfig from './kubeconfig';
import { create as kubectlCreate, Kubectl } from './kubectl';
import * as kubectlUtils from './kubectlUtils';
import * as explorer from './explorer';
import { create as draftCreate, Draft, CheckPresentMode as DraftCheckPresentMode } from './draft/draft';
import * as logger from './logger';
import * as helm from './helm';
import * as helmexec from './helm.exec';
import { HelmRequirementsCodeLensProvider } from './helm.requirementsCodeLens';
import { HelmTemplateHoverProvider } from './helm.hoverProvider';
import { HelmTemplatePreviewDocumentProvider, HelmInspectDocumentProvider } from './helm.documentProvider';
import { HelmTemplateCompletionProvider } from './helm.completionProvider';
import { Reporter } from './telemetry';
import * as telemetry from './telemetry-helper';
import * as extensionapi from './extension.api';
import {dashboardKubernetes} from './components/kubectl/dashboard';
import {portForwardKubernetes} from './components/kubectl/port-forward';
import { Errorable, failed, succeeded } from './errorable';
import { Git } from './components/git/git';
import { DebugSession } from './debug/debugSession';
import { getDebugProviderOfType, getSupportedDebuggerTypes } from './debug/providerRegistry';

import { registerYamlSchemaSupport } from './yaml-support/yaml-schema';
import * as clusterproviderregistry from './components/clusterprovider/clusterproviderregistry';
import * as azureclusterprovider from './components/clusterprovider/azure/azureclusterprovider';
import { KubernetesCompletionProvider } from "./yaml-support/yaml-snippet";
import { showWorkspaceFolderPick } from './hostutils';
import { DraftConfigurationProvider } from './draft/draftConfigurationProvider';
import { installHelm, installDraft, installKubectl } from './components/installer/installer';
import { KubernetesResourceVirtualFileSystemProvider, K8S_RESOURCE_SCHEME } from './kuberesources.virtualfs';
import { Container, isPod, isKubernetesResource, KubernetesCollection, Pod, KubernetesResource } from './kuberesources.objectmodel';

let explainActive = false;
let swaggerSpecPromise = null;

const kubectl = kubectlCreate(host, fs, shell, installDependencies);
const draft = draftCreate(host, fs, shell, installDependencies);
const configureFromClusterUI = configureFromCluster.uiProvider();
const createClusterUI = createCluster.uiProvider();
const clusterProviderRegistry = clusterproviderregistry.get();
const configMapProvider = new configmaps.ConfigMapTextProvider(kubectl);
const git = new Git(shell);

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
export async function activate(context): Promise<extensionapi.ExtensionAPI> {
    kubectl.checkPresent('activation');

    const treeProvider = explorer.create(kubectl, host);
    const resourceDocProvider = new KubernetesResourceVirtualFileSystemProvider(kubectl, host, vscode.workspace.rootPath);
    const previewProvider = new HelmTemplatePreviewDocumentProvider();
    const inspectProvider = new HelmInspectDocumentProvider();
    const completionProvider = new HelmTemplateCompletionProvider();
    const completionFilter = [
        "helm",
        {pattern: "**/templates/NOTES.txt"}
    ];

    const draftDebugProvider = new DraftConfigurationProvider();
    let draftDebugSession: vscode.DebugSession;

    const subscriptions = [

        // Commands - Kubernetes
        registerCommand('extension.vsKubernetesCreate',
            maybeRunKubernetesCommandForActiveWindow.bind(this, 'create', "Kubernetes Creating...")
        ),
        registerCommand('extension.vsKubernetesDelete', deleteKubernetes),
        registerCommand('extension.vsKubernetesApply', applyKubernetes),
        registerCommand('extension.vsKubernetesExplain', explainActiveWindow),
        registerCommand('extension.vsKubernetesLoad', loadKubernetes),
        registerCommand('extension.vsKubernetesGet', getKubernetes),
        registerCommand('extension.vsKubernetesRun', runKubernetes),
        registerCommand('extension.vsKubernetesLogs', logsKubernetes),
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
        registerCommand('extension.vsKubernetesUseContext', useContextKubernetes),
        registerCommand('extension.vsKubernetesClusterInfo', clusterInfoKubernetes),
        registerCommand('extension.vsKubernetesDeleteContext', deleteContextKubernetes),
        registerCommand('extension.vsKubernetesUseNamespace', useNamespaceKubernetes),
        registerCommand('extension.vsKubernetesDashboard', dashboardKubernetes),
        registerCommand('extension.vsKubernetesCopy', copyKubernetes),
        registerCommand('extension.vsKubernetesPortForward', portForwardKubernetes),
        registerCommand('extension.vsKubernetesLoadConfigMapData', configmaps.loadConfigMapData),
        registerCommand('extension.vsKubernetesDeleteFile', (obj) => { deleteKubernetesConfigFile(kubectl, obj, treeProvider); }),
        registerCommand('extension.vsKubernetesAddFile', (obj) => { addKubernetesConfigFile(kubectl, obj, treeProvider); }),

        // Commands - Helm
        registerCommand('extension.helmVersion', helmexec.helmVersion),
        registerCommand('extension.helmTemplate', helmexec.helmTemplate),
        registerCommand('extension.helmTemplatePreview', helmexec.helmTemplatePreview),
        registerCommand('extension.helmLint', helmexec.helmLint),
        registerCommand('extension.helmInspectValues', helmexec.helmInspectValues),
        registerCommand('extension.helmDryRun', helmexec.helmDryRun),
        registerCommand('extension.helmDepUp', helmexec.helmDepUp),
        registerCommand('extension.helmInsertReq', helmexec.insertRequirement),
        registerCommand('extension.helmCreate', helmexec.helmCreate),

        // Commands - Draft
        registerCommand('extension.draftVersion', execDraftVersion),
        registerCommand('extension.draftCreate', execDraftCreate),
        registerCommand('extension.draftUp', execDraftUp),

        // Draft debug configuration provider
        vscode.debug.registerDebugConfigurationProvider('draft', draftDebugProvider),

        // HTML renderers
        vscode.workspace.registerTextDocumentContentProvider(configureFromCluster.uriScheme, configureFromClusterUI),
        vscode.workspace.registerTextDocumentContentProvider(createCluster.uriScheme, createClusterUI),
        vscode.workspace.registerTextDocumentContentProvider(helm.PREVIEW_SCHEME, previewProvider),
        vscode.workspace.registerTextDocumentContentProvider(helm.INSPECT_SCHEME, inspectProvider),

        // Completion providers
        vscode.languages.registerCompletionItemProvider(completionFilter, completionProvider),
        vscode.languages.registerCompletionItemProvider('yaml', new KubernetesCompletionProvider()),

        // Hover providers
        vscode.languages.registerHoverProvider(
            { language: 'json', scheme: 'file' },
            { provideHover: provideHoverJson }
        ),
        vscode.languages.registerHoverProvider(
            { language: 'yaml', scheme: 'file' },
            { provideHover: provideHoverYaml }
        ),
        vscode.languages.registerHoverProvider(HELM_MODE, new HelmTemplateHoverProvider()),

        // Tree data providers
        vscode.window.registerTreeDataProvider('extension.vsKubernetesExplorer', treeProvider),

        // Temporarily loaded resource providers
        vscode.workspace.registerFileSystemProvider(K8S_RESOURCE_SCHEME, resourceDocProvider, { /* TODO: case sensitive? */ }),

        // Code lenses
        vscode.languages.registerCodeLensProvider(HELM_REQ_MODE, new HelmRequirementsCodeLensProvider()),

        // Telemetry
        registerTelemetry(context)
    ];

    await azureclusterprovider.init(clusterProviderRegistry, { shell: shell, fs: fs });

    // On save, refresh the Helm YAML preview.
    vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {
        if (!editorIsActive()) {
            if (helm.hasPreviewBeenShown()) {
                logger.helm.log("WARNING: No active editor during save. Helm preview was not updated.");
            }
            return;
        }
        if (e === vscode.window.activeTextEditor.document) {
            let doc = vscode.window.activeTextEditor.document;
            if (doc.uri.scheme != "file") {
                return;
            }
            let u = vscode.Uri.parse(helm.PREVIEW_URI);
            previewProvider.update(u);
        }

        // if there is an active Draft debugging session, restart the cycle
        if (draftDebugSession != undefined) {
            const session = vscode.debug.activeDebugSession;

            // TODO - how do we make sure this doesn't affect all other debugging sessions?
            // TODO - maybe check to see if `draft.toml` is present in the workspace
            // TODO - check to make sure we enable this only when Draft is installed
            if (session != undefined) {
                draftDebugSession.customRequest('evaluate', { restart: true });
            }
        }
    });

    vscode.debug.onDidTerminateDebugSession((e) => {

        // if there is an active Draft debugging session, restart the cycle
        if (draftDebugSession != undefined) {
            const session = vscode.debug.activeDebugSession;

            // TODO - how do we make sure this doesn't affect all other debugging sessions?
            // TODO - maybe check to see if `draft.toml` is present in the workspace
            // TODO - check to make sure we enable this only when Draft is installed
            if (session != undefined) {
                draftDebugSession.customRequest('evaluate', { stop: true });
            }
        }
    });

    // On editor change, refresh the Helm YAML preview
    vscode.window.onDidChangeActiveTextEditor((e: vscode.TextEditor) => {
        if (!editorIsActive()) {
            return;
        }
        let doc = vscode.window.activeTextEditor.document;
        if (doc.uri.scheme != "file") {
            return;
        }
        let u = vscode.Uri.parse(helm.PREVIEW_URI);
        previewProvider.update(u);
    });


    vscode.debug.onDidChangeActiveDebugSession((e: vscode.DebugSession)=> {
        if (e != undefined) {
            // keep a copy of the initial Draft debug session
            if (e.name.indexOf('Draft') >= 0) {
                draftDebugSession = e;
            }
        }
    });

    subscriptions.forEach((element) => {
        context.subscriptions.push(element);
    }, this);
    await registerYamlSchemaSupport();
    vscode.workspace.registerTextDocumentContentProvider(configmaps.uriScheme, configMapProvider);
    return {
        apiVersion: '0.1',
        clusterProviderRegistry: clusterProviderRegistry
    };
}

// this method is called when your extension is deactivated
export const deactivate = () => { };

function registerCommand(command: string, callback: (...args: any[]) => any): vscode.Disposable {
    const wrappedCallback = telemetry.telemetrise(command, callback);
    return vscode.commands.registerCommand(command, wrappedCallback);
}

function registerTelemetry(context: vscode.ExtensionContext): vscode.Disposable {
    return new Reporter(context);
}

function provideHover(document, position, token, syntax): Promise<vscode.Hover> {
    return new Promise(async (resolve) => {
        if (!explainActive) {
            resolve(null);
            return;
        }

        const body = document.getText();
        let obj: any = {};

        try {
            obj = syntax.parse(body);
        } catch (err) {
            // Bad document
            resolve(null);
            return;
        }

        // Not a k8s object.
        if (!obj.kind) {
            resolve(null);
            return;
        }

        let property = findProperty(document.lineAt(position.line)),
            field = syntax.parse(property),
            parentLine = syntax.findParent(document, position.line);

        while (parentLine !== -1) {
            let parentProperty = findProperty(document.lineAt(parentLine));
            field = syntax.parse(parentProperty) + '.' + field;
            parentLine = syntax.findParent(document, parentLine);
        }

        if (field === 'kind') {
            field = '';
        }

        explain(obj, field).then(
            (msg: string) => resolve(new vscode.Hover(msg))
        );
    });

}

function provideHoverJson(document, position, token) {
    const syntax = {
        parse: (text) => JSON.parse(text),
        findParent: (document, parentLine) => findParentJson(document, parentLine - 1)
    };

    return provideHover(document, position, token, syntax);
}

function provideHoverYaml(document, position, token) {
    const syntax = {
        parse: (text) => yaml.safeLoad(text),
        findParent: (document, parentLine) => findParentYaml(document, parentLine)
    };

    return provideHover(document, position, token, syntax);
}

function findProperty(line) {
    let ix = line.text.indexOf(':');
    return line.text.substring(line.firstNonWhitespaceCharacterIndex, ix);
}

function findParentJson(document, line) {
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

function findParentYaml(document, line) {
    let indent = yamlIndentLevel(document.lineAt(line).text);
    while (line >= 0) {
        let txt = document.lineAt(line);
        if (yamlIndentLevel(txt.text) < indent) {
            return line;
        }
        line = line - 1;
    }
    return line;
}

function yamlIndentLevel(str) {
    let i = 0;

    //eslint-disable-next-line no-constant-condition
    while (true) {
        if (str.length <= i || !isYamlIndentChar(str.charAt(i))) {
            return i;
        }
        ++i;
    }
}

function isYamlIndentChar(ch) {
    return ch === ' ' || ch === '-';
}

async function explain(obj, field) {
    return new Promise((resolve) => {
        if (!obj.kind) {
            vscode.window.showErrorMessage("Not a Kubernetes API Object!");
            resolve(null);
        }

        let ref = obj.kind;
        if (field && field.length > 0) {
            ref = ref + '.' + field;
        }

        if (!swaggerSpecPromise) {
            swaggerSpecPromise = explainer.readSwagger();
        }

        swaggerSpecPromise.then((s) => {
            resolve(explainer.readExplanation(s, ref));
        });
    });
}

function explainActiveWindow() {
    let editor = vscode.window.activeTextEditor;
    let bar = initStatusBar();

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


let statusBarItem;

function initStatusBar() {
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        statusBarItem.text = 'kubernetes-api-explain';
    }

    return statusBarItem;
}

// Runs a command for the text in the active window.
// Expects that it can append a filename to 'command' to create a complete kubectl command.
//
// @parameter command string The command to run
function maybeRunKubernetesCommandForActiveWindow(command, progressMessage) {
    let text, proc;

    let editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('This command operates on the open document. Open your Kubernetes resource file, and try again.');
        return false; // No open text editor
    }
    let namespace = vscode.workspace.getConfiguration('vs-kubernetes')['vs-kubernetes.namespace'];
    if (namespace) {
        command = command + ' --namespace ' + namespace + ' ';
    }

    const isKubernetesSyntax = (editor.document.languageId === 'json' || editor.document.languageId === 'yaml');
    const resultHandler = isKubernetesSyntax ? undefined /* default handling */ :
        (code, stdout, stderr) => {
            if (code === 0 ) {
                vscode.window.showInformationMessage(stdout);
            } else {
                vscode.window.showErrorMessage(`Kubectl command failed. The open document might not be a valid Kubernetes resource.  Details: ${stderr}`);
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
                });
            }
        });
    } else {
        kubectlTextDocument(command, editor.document, progressMessage, resultHandler);
    }
    return true;
}

function kubectlTextDocument(command: string, document: vscode.TextDocument, progressMessage: string, resultHandler: ShellHandler | undefined): void {
    if (document.uri.scheme === 'file') {
        const fullCommand = `${command} -f "${document.fileName}"`;
        kubectl.invokeWithProgress(fullCommand, progressMessage, resultHandler);
    } else {
        kubectlViaTempFile(command, document.getText(), progressMessage, resultHandler);
    }
}

function kubectlViaTempFile(command, fileContent, progressMessage, handler?) {
    const tmpobj = tmp.fileSync();
    fs.writeFileSync(tmpobj.name, fileContent);
    console.log(tmpobj.name);
    kubectl.invokeWithProgress(`${command} -f ${tmpobj.name}`, progressMessage, handler);
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
        let confirm = 'Save';
        let promise = vscode.window.showWarningMessage('You have unsaved changes!', confirm);
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
        });
    }

    callback(null, editor.document.uri);
    return;
}

function loadKubernetes(explorerNode?: explorer.ResourceNode) {
    if (explorerNode) {
        loadKubernetesCore(explorerNode.resourceId);
    } else {
        promptKindName(kuberesources.commonKinds, "load", { nameOptional: true }, (value) => {
            loadKubernetesCore(value);
        });
    }
}

function loadKubernetesCore(value: string) {
    const outputFormat = vscode.workspace.getConfiguration('vs-kubernetes')['vs-kubernetes.outputFormat'];
    const docname = `${value.replace('/', '-')}.${outputFormat}`;
    const nonce = new Date().getTime();
    const uri = `${K8S_RESOURCE_SCHEME}://loadkubernetescore/${docname}?value=${value}&_=${nonce}`;
    vscode.workspace.openTextDocument(vscode.Uri.parse(uri)).then((doc) => {
        if (doc) {
            vscode.window.showTextDocument(doc);
        }
    });
}

function exposeKubernetes() {
    let kindName = findKindNameOrPrompt(kuberesources.exposableKinds, 'expose', { nameOptional: false}, (kindName: string) => {
        if (!kindName) {
            vscode.window.showErrorMessage('couldn\'t find a relevant type to expose.');
            return;
        }

        let cmd = `expose ${kindName}`;
        let ports = getPorts();

        if (ports && ports.length > 0) {
            cmd += ' --port=' + ports[0];
        }

        kubectl.invokeWithProgress(cmd, "Kubernetes Exposing...");
    });
}

function getKubernetes(explorerNode?: any) {
    if (explorerNode) {
        const id = explorerNode.resourceId || explorerNode.id;
        kubectl.invokeInSharedTerminal(`get ${id} -o wide`);
    } else {
        findKindNameOrPrompt(kuberesources.commonKinds, 'get', { nameOptional: true }, (value) => {
            kubectl.invokeInSharedTerminal(` get ${value} -o wide`);
        });
    }
}

function findVersion() {
    return {
        then: findVersionInternal
    };
}

function findVersionInternal(fn) {
    // No .git dir, use 'latest'
    // TODO: use 'git rev-parse' to detect upstream directories
    if (!fs.existsSync(path.join(vscode.workspace.rootPath, '.git'))) {
        fn('latest');
        return;
    }

    shell.execCore('git describe --always --dirty', shell.execOpts()).then(({code, stdout, stderr}) => {
        if (code !== 0) {
            vscode.window.showErrorMessage('git log returned: ' + code);
            console.log(stderr);
            fn('error');
            return;
        }
        fn(stdout);
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
    let appName = path.basename(vscode.workspace.rootPath);
    return await findPodsByLabel(`run=${appName}`);
}

async function findDebugPodsForApp(): Promise<FindPodsResult> {
    if (!vscode.workspace.rootPath) {
        return { succeeded: true, pods: [] };
    }
    let appName = path.basename(vscode.workspace.rootPath);
    return await findPodsByLabel(`run=${appName}-debug`);
}

export interface FindPodsResult {
    readonly succeeded: boolean;
    readonly pods: Pod[];
}

function findNameAndImage() {
    return {
        then: _findNameAndImageInternal
    };
}

function _findNameAndImageInternal(fn) {
    if (vscode.workspace.rootPath === undefined) {
        vscode.window.showErrorMessage('This command requires an open folder.');
        return;
    }
    const folderName = path.basename(vscode.workspace.rootPath);
    const name = docker.sanitiseTag(folderName);
    findVersion().then((version) => {
        let image = name + ":" + version;
        let user = vscode.workspace.getConfiguration().get("vsdocker.imageUser", null);
        if (user) {
            image = user + '/' + image;
        }

        fn(name.trim(), image.trim());
    });
}

function scaleKubernetes() {
    findKindNameOrPrompt(kuberesources.scaleableKinds, 'scale', {}, (kindName) => {
        promptScaleKubernetes(kindName);
    });
}

function promptScaleKubernetes(kindName: string) {
    vscode.window.showInputBox({ prompt: `How many replicas would you like to scale ${kindName} to?` }).then((value) => {
        if (value) {
            let replicas = parseFloat(value);
            if (Number.isInteger(replicas) && replicas >= 0) {
                invokeScaleKubernetes(kindName, replicas);
            } else {
                vscode.window.showErrorMessage('Replica count must be a non-negative integer');
            }
        }
    });
}

function invokeScaleKubernetes(kindName: string, replicas: number) {
    kubectl.invokeWithProgress(`scale --replicas=${replicas} ${kindName}`, "Kubernetes Scaling...");
}

function runKubernetes() {
    buildPushThenExec((name, image) => {
        kubectl.invokeWithProgress(`run ${name} --image=${image}`, "Creating a Deployment...");
    });
}

function diagnosePushError(exitCode: number, error: string): string {
    if (error.includes("denied")) {
        const user = vscode.workspace.getConfiguration().get("vsdocker.imageUser", null);
        if (user) {
            return "Failed to push to Docker Hub. Try running docker login.";
        } else {
            return "Failed to push to Docker Hub. Try setting vsdocker.imageUser.";
        }
    }
    return 'Image push failed.';
}

function buildPushThenExec(fn) {
    findNameAndImage().then((name, image) => {
        vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (p) => {
            p.report({ message: "Docker Building..." });
            const buildResult = await shell.exec(`docker build -t ${image} .`);
            if (buildResult.code === 0) {
                vscode.window.showInformationMessage(image + ' built.');
                p.report({ message: "Docker Pushing..." });
                const pushResult = await shell.exec('docker push ' + image);
                if (pushResult.code === 0) {
                    vscode.window.showInformationMessage(image + ' pushed.');
                    fn(name, image);
                } else {
                    const diagnostic = diagnosePushError(pushResult.code, pushResult.stderr);
                    vscode.window.showErrorMessage(`${diagnostic} See Output window for docker push error message.`);
                    kubeChannel.showOutput(pushResult.stderr, 'Docker');
                }
            } else {
                vscode.window.showErrorMessage('Image build failed. See Output window for details.');
                kubeChannel.showOutput(buildResult.stderr, 'Docker');
                console.log(buildResult.stderr);
            }
        });
    });
}

export function tryFindKindNameFromEditor(): Errorable<ResourceKindName> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return { succeeded: false, error: ['No open editor']}; // No open text editor
    }
    const text = editor.document.getText();
    return findKindNameForText(text);
}

interface ResourceKindName {
    readonly namespace: string;
    readonly kind: string;
    readonly resourceName: string;
}

function findKindNameForText(text): Errorable<ResourceKindName> {
    const kindNames = findKindNamesForText(text);
    if (!succeeded(kindNames)) {
        return { succeeded: false, error: kindNames.error };
    }
    if (kindNames.result.length > 1) {
        return { succeeded: false, error: ['the open document contains multiple Kubernetes resources'] };
    }
    return { succeeded: true, result: kindNames.result[0] };
}

function findKindNamesForText(text): Errorable<ResourceKindName[]> {
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

export function findKindNameOrPrompt(resourceKinds: kuberesources.ResourceKind[], descriptionVerb, opts, handler) {
    let kindObject = tryFindKindNameFromEditor();
    if (failed(kindObject)) {
        promptKindName(resourceKinds, descriptionVerb, opts, handler);
    } else {
        handler(`${kindObject.result.kind}/${kindObject.result.resourceName}`);
    }
}

function promptKindName(resourceKinds: kuberesources.ResourceKind[], descriptionVerb, opts, handler) {
    vscode.window.showInputBox({ prompt: "What resource do you want to " + descriptionVerb + "?", placeHolder: 'Empty string to be prompted' }).then((resource) => {
        if (resource === '') {
            quickPickKindName(resourceKinds, opts, handler);
        } else if (resource === undefined) {
            return;
        } else {
            handler(resource);
        }
    });
}

function quickPickKindName(resourceKinds: kuberesources.ResourceKind[], opts, handler) {
    if (resourceKinds.length === 1) {
        quickPickKindNameFromKind(resourceKinds[0], opts, handler);
        return;
    }

    vscode.window.showQuickPick(resourceKinds).then((resourceKind) => {
        if (resourceKind) {
            quickPickKindNameFromKind(resourceKind, opts, handler);
        }
    });
}

function quickPickKindNameFromKind(resourceKind: kuberesources.ResourceKind, opts, handler) {
    let kind = resourceKind.abbreviation;
    kubectl.invoke("get " + kind, (code, stdout, stderr) => {
        if (code !== 0) {
            vscode.window.showErrorMessage(stderr);
            return;
        }
        let names = parseNamesFromKubectlLines(stdout);
        if (names.length === 0) {
            vscode.window.showInformationMessage("No resources of type " + resourceKind.displayName + " in cluster");
            return;
        }
        if (opts && opts.nameOptional) {
            names.push('(all)');
            vscode.window.showQuickPick(names).then((name) => {
                if (name) {
                    let kindName;
                    if (name === '(all)') {
                        kindName = kind;
                    } else {
                        kindName = kind + '/' + name;
                    }
                    handler(kindName);
                }
            });
        } else {
            vscode.window.showQuickPick(names).then((name) => {
                if (name) {
                    let kindName = kind + '/' + name;
                    handler(kindName);
                }
            });
        }
    });
}

function containsName(kindName) {
    if (typeof kindName === 'string' || kindName instanceof String) {
        return kindName.indexOf('/') > 0;
    }
    return false;
}

function parseNamesFromKubectlLines(text) {
    let lines = text.split('\n');
    lines.shift();

    let names = lines.filter((line) => {
        return line.length > 0;
    }).map((line) => {
        return parseName(line);
    });

    return names;
}

function parseName(line) {
    return line.split(' ')[0];
}

function findPod(callback: (pod: PodSummary) => void) {
    let editor = vscode.window.activeTextEditor;
    if (editor) {
        let text = editor.document.getText();
        try {
            let obj: {} = yaml.safeLoad(text);
            if (isPod(obj)) {
                callback({
                    name: obj.metadata.name,
                    namespace: obj.metadata.namespace
                });
                return;
            }
        } catch (ex) {
            // pass
        }
    }

    quickPickKindName(
        [kuberesources.allKinds.pod],
        {nameOptional: false},
        (pod) => {
            callback({
                name: pod.split('/')[1],
                namespace: undefined // should figure out how to handle namespaces.
            });
        }
    );
}

async function getContainers(pod: PodSummary): Promise<Container[] | undefined> {
    let cmd = `get pod/${pod.name} -o jsonpath="{'NAME\\tIMAGE\\n'}{range .spec.containers[*]}{.name}{'\\t'}{.image}{'\\n'}{end}"`;
    if (pod.namespace && pod.namespace.length > 0) {
        cmd += ' --namespace=' + pod.namespace;
    }
    const containers = await kubectl.asLines(cmd);
    if (failed(containers)) {
        vscode.window.showErrorMessage("Failed to get containers in pod: " + containers.error[0]);
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

async function selectPod(scope: PodSelectionScope, fallback: PodSelectionFallback): Promise<any | null> {
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
        label: `${element.metadata.namespace}/${element.metadata.name}`,
        description: '',
        pod: element
    };});

    const value = await vscode.window.showQuickPick(pickItems);

    if (!value) {
        return null;
    }

    return value.pod;
}

async function logsKubernetes(explorerNode?: explorer.ResourceNode) {
    if (explorerNode) {
        const podSummary = { name: explorerNode.id, namespace: undefined };  // TODO: namespaces
        const container = await selectContainerForPod(podSummary);
        if (container) {
            getLogsForContainer(podSummary.name, podSummary.namespace, container.name);
        }
    } else {
        findPod(getLogsForPod);
    }
}

async function getLogsForPod(pod: PodSummary) {
    if (!pod) {
        vscode.window.showErrorMessage('Can\'t find a pod!');
        return;
    }
    const container = await selectContainerForPod(pod);
    if (container) {
        getLogsForContainer(pod.name, pod.namespace, container.name);
    }
}

function getLogsForContainer(podName: string, podNamespace: string | undefined, containerName: string | undefined) {
    let cmd = 'logs ' + podName;
    if (podNamespace && podNamespace.length > 0) {
        cmd += ' --namespace=' + podNamespace;
    }
    if (containerName) {
        cmd += ' --container=' + containerName;
    }
    kubectl.invokeInSharedTerminal(cmd);
}

function kubectlOutputTo(name: string) {
    return (code, stdout, stderr) => kubectlOutput(code, stdout, stderr, name);
}

function kubectlOutput(result, stdout, stderr, name) {
    if (result !== 0) {
        vscode.window.showErrorMessage('Command failed: ' + stderr);
        return;
    }
    kubeChannel.showOutput(stdout, name);
}

function getPorts() {
    let file = vscode.workspace.rootPath + '/Dockerfile';
    if (!fs.existsSync(file)) {
        return null;
    }
    try {
        let data = fs.readFileSync(file, 'utf-8');
        let obj = dockerfileParse(data);
        return obj.expose;
    } catch (ex) {
        console.log(ex);
        return null;
    }
}

function describeKubernetes(explorerNode?: explorer.ResourceNode) {
    if (explorerNode) {
        kubectl.invokeInSharedTerminal(`describe ${explorerNode.resourceId}`);
    } else {
        findKindNameOrPrompt(kuberesources.commonKinds, 'describe', { nameOptional: true }, (value) => {
            kubectl.invokeInSharedTerminal(`describe ${value}`);
        });
    }
}

interface PodSummary {
    readonly name: string;
    readonly namespace: string | undefined;
    readonly spec?: {
        containers?: Container[]
    };
}

async function selectContainerForPod(pod: PodSummary): Promise<Container | null> {
    if (!pod) {
        return null;
    }

    const containers = (pod.spec && pod.spec.containers) ? pod.spec.containers : await getContainers(pod);

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
    };});

    const value = await vscode.window.showQuickPick(pickItems, { placeHolder: "Select container" });

    if (!value) {
        return null;
    }

    return value.container;
}

function execKubernetes() {
    execKubernetesCore(false);
}

async function terminalKubernetes(explorerNode?: explorer.ResourceNode) {
    if (explorerNode) {
        const podSummary = { name: explorerNode.id, namespace: undefined };  // TODO: namespaces
        const container = await selectContainerForPod(podSummary);
        if (container) {
            // For those images (e.g. built from Busybox) where bash may not be installed by default, use sh instead.
            const suggestedShell = await suggestedShellForContainer(podSummary.name, podSummary.namespace, container.name);
            execTerminalOnContainer(podSummary.name, podSummary.namespace, container.name, suggestedShell);
        }
    } else {
        execKubernetesCore(true);
    }
}

async function execKubernetesCore(isTerminal): Promise<void> {
    let opts: any = { prompt: 'Please provide a command to execute' };

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

    const container = await selectContainerForPod(pod.metadata);

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

async function isBashOnContainer(podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<boolean> {
    const result = await kubectl.invokeAsync(`exec ${podName} -c ${containerName} -- ls -la /bin/bash`);
    return !result.code;
}

async function suggestedShellForContainer(podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<string> {
    if (await isBashOnContainer(podName, podNamespace, containerName)) {
        return 'bash';
    }
    return 'sh';
}

async function syncKubernetes(): Promise<void> {
    const pod = await selectPod(PodSelectionScope.App, PodSelectionFallback.None);
    if (!pod) {
        return;
    }

    const container = await selectContainerForPod(pod);
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

async function refreshExplorer() {
    await vscode.commands.executeCommand("extension.vsKubernetesRefreshExplorer");
}

async function reportDeleteResult(resourceId: string, shellResult: ShellResult) {
    if (shellResult.code !== 0) {
        await vscode.window.showErrorMessage(`Failed to delete resource '${resourceId}': ${shellResult.stderr}`);
        return;
    }
    await vscode.window.showInformationMessage(shellResult.stdout);
    refreshExplorer();
}

const deleteKubernetes = async (explorerNode?: explorer.ResourceNode) => {
    if (explorerNode) {
        const answer = await vscode.window.showWarningMessage(`Do you want to delete the resource '${explorerNode.resourceId}'?`, ...deleteMessageItems);
        if (answer.isCloseAffordance) {
            return;
        }
        const shellResult = await kubectl.invokeAsyncWithProgress(`delete ${explorerNode.resourceId}`, `Deleting ${explorerNode.resourceId}...`);
        await reportDeleteResult(explorerNode.resourceId, shellResult);
    } else {
        promptKindName(kuberesources.commonKinds, 'delete', { nameOptional: true }, async (kindName) => {
            if (kindName) {
                let commandArgs = kindName;
                if (!containsName(kindName)) {
                    commandArgs = kindName + " --all";
                }
                const shellResult = await kubectl.invokeAsyncWithProgress(`delete ${commandArgs}`, `Deleting ${kindName}...`);
                await reportDeleteResult(kindName, shellResult);
            }
        });
    }
};

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

const handleError = (err) => {
    if (err) {
        vscode.window.showErrorMessage(err);
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
            fileFormat = (data.trim().length > 0 && data.trim()[0] == '{') ? "json" : "yaml";
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

        kubectl.invoke(` get -o ${fileFormat} ${kindName}`, (result, stdout, stderr) => {
            if (result == 1 && stderr.indexOf('NotFound') >= 0) {
                callback({ result: DiffResultKind.NoClusterResource, resourceName: kindName });
                return;
            }
            else if (result !== 0) {
                callback({ result: DiffResultKind.GetFailed, stderr: stderr });
                return;
            }

            let serverFile = path.join(os.tmpdir(), `server.${fileFormat}`);
            fs.writeFile(serverFile, stdout, handleError);

            vscode.commands.executeCommand(
                'vscode.diff',
                shell.fileUri(serverFile),
                fileUri).then((result) => {
                    console.log(result);
                    callback({ result: DiffResultKind.Succeeded });
                });
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
            buildPushThenExec(_debugInternal);
        }
    }
};

const debugAttachKubernetes = async (explorerNode: explorer.KubernetesObject) => {
    const workspaceFolder = await showWorkspaceFolderPick();
    if (workspaceFolder) {
        new DebugSession(kubectl).attach(workspaceFolder, explorerNode ? explorerNode.id : null);
    }
};

const _debugInternal = (name, image) => {
    // TODO: optionalize/customize the '-debug'
    // TODO: make this smarter.
    vscode.window.showInputBox({
        prompt: 'Debug command for your container:',
        placeHolder: 'Example: node debug server.js' }
    ).then((cmd) => {
        if (!cmd) {
            return;
        }

        _doDebug(name, image, cmd);
    });
};

const _doDebug = async (name, image, cmd) => {
    const deploymentName = `${name}-debug`;
    const runCmd = `run ${deploymentName} --image=${image} -i --attach=false -- ${cmd}`;
    console.log(runCmd);

    const sr = await kubectl.invokeAsync(runCmd);

    if (sr.code !== 0) {
        vscode.window.showErrorMessage('Failed to start debug container: ' + sr.stderr);
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

    let podName = podList[0].metadata.name;
    vscode.window.showInformationMessage('Debug pod running as: ' + podName);

    waitForRunningPod(podName, () => {
        kubectl.invoke(` port-forward ${podName} 5858:5858 8000:8000`);

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
                    kubectl.invoke(exposeCmd, (result, stdout, stderr) => {
                        if (result !== 0) {
                            vscode.window.showErrorMessage('Failed to expose deployment: ' + stderr);
                            return;
                        }
                        vscode.window.showInformationMessage('Deployment exposed. Run Kubernetes Get > service ' + deploymentName + ' for IP address');
                    });
                });
            });
        }, (err) => {
            vscode.window.showInformationMessage('Error: ' + err.message);
        });
    });
};

const waitForRunningPod = (name, callback) => {
    kubectl.invoke(` get pods ${name} -o jsonpath --template="{.status.phase}"`,
        (result, stdout, stderr) => {
            if (result !== 0) {
                vscode.window.showErrorMessage(`Failed to run command (${result}) ${stderr}`);
                return;
            }

            if (stdout === 'Running') {
                callback();
                return;
            }

            setTimeout(() => waitForRunningPod(name, callback), 1000);
        });
};

function exists(kind, name, handler) {
    //eslint-disable-next-line no-unused-vars
    kubectl.invoke('get ' + kind + ' ' + name, (result) => {
        handler(result === 0);
    });
}

function deploymentExists(deploymentName, handler) {
    exists('deployments', deploymentName, handler);
}

function serviceExists(serviceName, handler) {
    exists('services', serviceName, handler);
}

function removeDebugKubernetes() {
    //eslint-disable-next-line no-unused-vars
    findNameAndImage().then((name, image) => {
        let deploymentName = name + '-debug';
        deploymentExists(deploymentName, (deployment) => {
            serviceExists(deploymentName, (service) => {
                if (!deployment && !service) {
                    vscode.window.showInformationMessage(deploymentName + ': nothing to clean up');
                    return;
                }

                let toDelete = deployment ? ('deployment' + (service ? ' and service' : '')) : 'service';
                vscode.window.showWarningMessage('This will delete ' + toDelete + ' ' + deploymentName, 'Delete').then((opt) => {
                    if (opt !== 'Delete') {
                        return;
                    }

                    if (service) {
                        kubectl.invoke('delete service ' + deploymentName);
                    }

                    if (deployment) {
                        kubectl.invoke('delete deployment ' + deploymentName);
                    }
                });
            });
        });
    });
}

async function configureFromClusterKubernetes() {
    const newId: string = uuid.v4();
    vscode.commands.executeCommand('vscode.previewHtml', configureFromCluster.operationUri(newId), 2, "Add Existing Kubernetes Cluster");
}

async function createClusterKubernetes() {
    const newId: string = uuid.v4();
    vscode.commands.executeCommand('vscode.previewHtml', createCluster.operationUri(newId), 2, "Create Kubernetes Cluster");
}

async function useContextKubernetes(explorerNode: explorer.KubernetesObject) {
    const targetContext = explorerNode.metadata.context;
    const shellResult = await kubectl.invokeAsync(`config use-context ${targetContext}`);
    if (shellResult.code === 0) {
        refreshExplorer();
    } else {
        vscode.window.showErrorMessage(`Failed to set '${targetContext}' as current cluster: ${shellResult.stderr}`);
    }
}

async function clusterInfoKubernetes(explorerNode: explorer.KubernetesObject) {
    const targetContext = explorerNode.metadata.context;
    kubectl.invokeInSharedTerminal("cluster-info");
}

async function deleteContextKubernetes(explorerNode: explorer.KubernetesObject) {
    const answer = await vscode.window.showWarningMessage(`Do you want to delete the cluster '${explorerNode.id}' from the kubeconfig?`, ...deleteMessageItems);
    if (answer.isCloseAffordance) {
        return;
    }
    if (await kubectlUtils.deleteCluster(kubectl, explorerNode.metadata)) {
        refreshExplorer();
    }
}

async function useNamespaceKubernetes(explorerNode: explorer.KubernetesObject) {
    if (await kubectlUtils.switchNamespace(kubectl, explorerNode.id)) {
        refreshExplorer();
    }
}

function copyKubernetes(explorerNode: explorer.KubernetesObject) {
    clipboard.writeSync(explorerNode.id);
}

// TODO: having to export this is untidy - unpick dependencies and move
export async function installDependencies() {
    // TODO: gosh our binchecking is untidy
    const gotKubectl = await kubectl.checkPresent('silent');
    const gotHelm = helmexec.ensureHelm(helmexec.EnsureMode.Silent);
    const gotDraft = await draft.checkPresent(DraftCheckPresentMode.Silent);

    // TODO: parallelise
    await installDependency("kubectl", gotKubectl, installKubectl);
    await installDependency("Helm", gotHelm, installHelm);
    await installDependency("Draft", gotDraft, installDraft);

    kubeChannel.showOutput("Done");
}

async function installDependency(name: string, alreadyGot: boolean, installFunc: (shell: Shell) => Promise<Errorable<void>>): Promise<void> {
    if (alreadyGot) {
        kubeChannel.showOutput(`Already got ${name}...`);
    } else {
        kubeChannel.showOutput(`Installing ${name}...`);
        const result = await installFunc(shell);
        if (failed(result)) {
            kubeChannel.showOutput(`Unable to install ${name}: ${result.error[0]}`);
        }
    }
}

async function execDraftVersion() {
    if (!(await draft.checkPresent(DraftCheckPresentMode.Alert))) {
        return;
    }

    const dvResult = await draft.invoke("version");

    if (dvResult.code === 0) {
        host.showInformationMessage(dvResult.stdout);
    } else {
        host.showErrorMessage(dvResult.stderr);
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
    const packOpt = pack ? ` -p ${pack}` : '';
    const dcResult = await draft.invoke(`create -a ${appName} ${packOpt} "${vscode.workspace.rootPath}"`);

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
    if (!hadPack && sr.stderr.indexOf('Unable to select a starter pack') >= 0) {
        return DraftCreateResult.NeedsPack;
    }
    return DraftCreateResult.Fatal;
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

function editorIsActive(): boolean {
    // force type coercion
    return (vscode.window.activeTextEditor) ? true : false;
}
