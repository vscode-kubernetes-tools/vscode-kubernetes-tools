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

// Internal dependencies
import { host } from './host';
import * as explainer from './explainer';
import { shell, ShellResult } from './shell';
import * as configureFromCluster from './configurefromcluster';
import * as createCluster from './createcluster';
import { UIRequest as WizardUIRequest } from './wizard';
import * as kuberesources from './kuberesources';
import * as docker from './docker';
import { kubeChannel } from './kubeChannel';
import * as kubeconfig from './kubeconfig';
import { create as kubectlCreate, Kubectl } from './kubectl';
import * as kubectlUtils from './kubectlUtils';
import * as explorer from './explorer';
import { create as draftCreate, Draft } from './draft';
import * as logger from './logger';
import * as helm from './helm';
import * as helmexec from './helm.exec';
import { HelmRequirementsCodeLensProvider } from './helm.requirementsCodeLens';
import { HelmTemplateHoverProvider } from './helm.hoverProvider';
import { HelmTemplatePreviewDocumentProvider, HelmInspectDocumentProvider } from './helm.documentProvider';
import { HelmTemplateCompletionProvider } from './helm.completionProvider';

let explainActive = false;
let swaggerSpecPromise = null;

const kubectl = kubectlCreate(host, fs, shell);
const draft = draftCreate(host, fs, shell);
const configureFromClusterUI = configureFromCluster.uiProvider(fs, shell);
const createClusterUI = createCluster.uiProvider(fs, shell);

const deleteMessageItems: vscode.MessageItem[] = [
    {
        title: "Delete"
    },
    {
        title: "Close",
        isCloseAffordance: true
    }
];

// Filters for different Helm file types.
// TODO: Consistently apply these to the provders registered.
export const HELM_MODE: vscode.DocumentFilter = { language: "helm", scheme: "file" };
export const HELM_REQ_MODE: vscode.DocumentFilter = { language: "helm", scheme: "file", pattern: "**/requirements.yaml"};
export const HELM_CHART_MODE: vscode.DocumentFilter = { language: "helm", scheme: "file", pattern: "**/Chart.yaml" };
export const HELM_TPL_MODE: vscode.DocumentFilter = { language: "helm", scheme: "file", pattern: "**/templates/*.*" };

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context) {
    kubectl.checkPresent('activation');

    const treeProvider = explorer.create(kubectl, host);
    const previewProvider = new HelmTemplatePreviewDocumentProvider();
    const inspectProvider = new HelmInspectDocumentProvider();
    const completionProvider = new HelmTemplateCompletionProvider();
    const completionFilter = [
        "helm",
        {language: "yaml", pattern: "**/templates/*.yaml"},
        {pattern: "**/templates/NOTES.txt"}
    ];

    const subscriptions = [

        // Commands - Kubernetes
        vscode.commands.registerCommand('extension.vsKubernetesCreate',
            maybeRunKubernetesCommandForActiveWindow.bind(this, 'create -f')
        ),
        vscode.commands.registerCommand('extension.vsKubernetesDelete', deleteKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesApply', applyKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesExplain', explainActiveWindow),
        vscode.commands.registerCommand('extension.vsKubernetesLoad', loadKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesGet', getKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesRun', runKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesLogs', logsKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesExpose', exposeKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesDescribe', describeKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesSync', syncKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesExec', execKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesTerminal', terminalKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesDiff', diffKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesScale', scaleKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesDebug', debugKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesRemoveDebug', removeDebugKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesConfigureFromCluster', configureFromClusterKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesCreateCluster', createClusterKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesRefreshExplorer', () => treeProvider.refresh()),
        vscode.commands.registerCommand('extension.vsKubernetesUseContext', useContextKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesClusterInfo', clusterInfoKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesDeleteContext', deleteContextKubernetes),
        vscode.commands.registerCommand('extension.vsKubernetesUseNamespace', useNamespaceKubernetes),

        // Commands - Helm
        vscode.commands.registerCommand('extension.helmVersion', helmexec.helmVersion),
        vscode.commands.registerCommand('extension.helmTemplate', helmexec.helmTemplate),
        vscode.commands.registerCommand('extension.helmTemplatePreview', helmexec.helmTemplatePreview),
        vscode.commands.registerCommand('extension.helmLint', helmexec.helmLint),
        vscode.commands.registerCommand('extension.helmInspectValues', helmexec.helmInspectValues),
        vscode.commands.registerCommand('extension.helmDryRun', helmexec.helmDryRun),
        vscode.commands.registerCommand('extension.helmDepUp', helmexec.helmDepUp),
        vscode.commands.registerCommand('extension.helmInsertReq', helmexec.insertRequirement),
        vscode.commands.registerCommand('extension.helmCreate', helmexec.helmCreate),

        // Commands - Draft
        vscode.commands.registerCommand('extension.draftVersion', execDraftVersion),
        vscode.commands.registerCommand('extension.draftCreate', execDraftCreate),
        vscode.commands.registerCommand('extension.draftUp', execDraftUp),

        // HTML renderers
        vscode.workspace.registerTextDocumentContentProvider(configureFromCluster.uriScheme, configureFromClusterUI),
        vscode.workspace.registerTextDocumentContentProvider(createCluster.uriScheme, createClusterUI),
        vscode.workspace.registerTextDocumentContentProvider(helm.PREVIEW_SCHEME, previewProvider),
        vscode.workspace.registerTextDocumentContentProvider(helm.INSPECT_SCHEME, inspectProvider),

        // Completion providers
        vscode.languages.registerCompletionItemProvider(completionFilter, completionProvider),

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

        // Code lenses
        vscode.languages.registerCodeLensProvider(HELM_REQ_MODE, new HelmRequirementsCodeLensProvider())
    ];

    // On save, refresh the Helm YAML preview.
    vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {
        if (!editorIsActive()) {
            logger.helm.log("WARNING: No active editor during save. Nothing saved.");
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

    subscriptions.forEach((element) => {
        context.subscriptions.push(element);
    }, this);
}

// this method is called when your extension is deactivated
export const deactivate = () => { };

function provideHover(document, position, token, syntax) : Promise<vscode.Hover> {
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
            (msg : string) => resolve(new vscode.Hover(msg))
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
function maybeRunKubernetesCommandForActiveWindow(command) {
    let text, proc;

    let editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor!');
        return false; // No open text editor
    }
    let namespace = vscode.workspace.getConfiguration('vs-kubernetes')['vs-kubernetes.namespace'];
    if (namespace) {
        command = command + '--namespace ' + namespace + ' ';
    }
    if (editor.selection) {
        text = editor.document.getText(editor.selection);
        if (text.length > 0) {
            kubectlViaTempFile(command, text);
            return true;
        }
    }
    if (editor.document.isUntitled) {
        text = editor.document.getText();
        if (text.length > 0) {
            kubectlViaTempFile(command, text);
            return true;
        }
        return false;
    }
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
                    kubectl.invoke(`${command} "${editor.document.fileName}"`);
                });
            }
        });
    } else {
        const fullCommand = `${command} "${editor.document.fileName}"`;
        console.log(fullCommand);
        kubectl.invoke(fullCommand);
    }
    return true;
}

function kubectlViaTempFile(command, fileContent) {
    const tmpobj = tmp.fileSync();
    fs.writeFileSync(tmpobj.name, fileContent);
    console.log(tmpobj.name);
    kubectl.invoke(`${command} ${tmpobj.name}`);
}

/**
 * Gets the text content (in the case of unsaved or selections), or the filename
 *
 * @param callback function(text, filename)
 */
function getTextForActiveWindow(callback) {
    let text;
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('No active editor!');
        callback(null, null);
        return;
    }

    if (editor.selection) {
        text = editor.document.getText(editor.selection);

        if (text.length === 0) {
            return;
        }

        callback(text, null);
        return;
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

                callback(null, editor.document.fileName);
            });

            return;
        });
    }

    callback(null, editor.document.fileName);
    return;
}

function loadKubernetes(explorerNode? : explorer.ResourceNode) {
    if (explorerNode) {
        loadKubernetesCore(explorerNode.resourceId);
    } else {
        promptKindName(kuberesources.commonKinds, "load", { nameOptional: true }, (value) => {
            loadKubernetesCore(value);
        });
    }
}

function loadKubernetesCore(value : string) {
    kubectl.invokeWithProgress(" -o json get " + value, `Loading ${value}...`, (result, stdout, stderr) => {
        if (result !== 0) {
            vscode.window.showErrorMessage('Get command failed: ' + stderr);
            return;
        }

        const filename = value.replace('/', '-');
        const filepath = path.join(vscode.workspace.rootPath || "", filename + '.json');

        vscode.workspace.openTextDocument(vscode.Uri.parse('untitled:' + filepath)).then((doc) => {
            const start = new vscode.Position(0, 0),
                end = new vscode.Position(0, 0),
                range = new vscode.Range(start, end),
                edit = new vscode.TextEdit(range, stdout),
                wsEdit = new vscode.WorkspaceEdit();

            wsEdit.set(doc.uri, [edit]);
            vscode.workspace.applyEdit(wsEdit);
            vscode.window.showTextDocument(doc);
        });
    });
}

function exposeKubernetes() {
    let kindName = findKindName();
    if (!kindName) {
        vscode.window.showErrorMessage('couldn\'t find a relevant type to expose.');
        return;
    }

    let cmd = `expose ${kindName}`;
    let ports = getPorts();

    if (ports && ports.length > 0) {
        cmd += ' --port=' + ports[0];
    }

    kubectl.invoke(cmd);
}

function getKubernetes(explorerNode? : any) {
    if (explorerNode) {
        const id = explorerNode.resourceId || explorerNode.id;
        const fn = kubectlOutputTo(id + '-get');
        kubectl.invoke(`get ${id} -o wide`, fn);
    } else {
        let kindName = findKindName();
        if (kindName) {
            maybeRunKubernetesCommandForActiveWindow('get --no-headers -o wide -f ');
            return;
        }
        findKindNameOrPrompt(kuberesources.commonKinds, 'get', { nameOptional: true }, (value) => {
            kubectl.invoke(" get " + value + " -o wide --no-headers");
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

function findPods(labelQuery, callback) {
    kubectl.invoke(` get pods -o json -l ${labelQuery}`, (result, stdout, stderr) => {
        if (result !== 0) {
            vscode.window.showErrorMessage('Kubectl command failed: ' + stderr);
            return;
        }
        try {
            let podList = JSON.parse(stdout);
            callback(podList);
        } catch (ex) {
            console.log(ex);
            vscode.window.showErrorMessage('unexpected error: ' + ex);
        }
    });
}

function findPodsForApp(callback) {
    let appName = path.basename(vscode.workspace.rootPath);
    findPods(`run=${appName}`, callback);
}

function findDebugPodsForApp(callback) {
    let appName = path.basename(vscode.workspace.rootPath);
    findPods(`run=${appName}-debug`, callback);
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

function promptScaleKubernetes(kindName : string) {
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

function invokeScaleKubernetes(kindName : string, replicas : number) {
    kubectl.invoke(`scale --replicas=${replicas} ${kindName}`);
}

function runKubernetes() {
    buildPushThenExec((name, image) => {
        kubectl.invoke(`run ${name} --image=${image}`);
    });
}

function buildPushThenExec(fn) {
    findNameAndImage().then((name, image) => {
        shell.exec(`docker build -t ${image} .`).then(({code, stdout, stderr}) => {
            if (code === 0) {
                vscode.window.showInformationMessage(image + ' built.');
                shell.exec('docker push ' + image).then(({code, stdout, stderr}) => {
                    if (code === 0) {
                        vscode.window.showInformationMessage(image + ' pushed.');
                        fn(name, image);
                    } else {
                        vscode.window.showErrorMessage('Image push failed. See Output window for details.');
                        kubeChannel.showOutput(stderr, 'Docker');
                        console.log(stderr);
                    }
                });
            } else {
                vscode.window.showErrorMessage('Image build failed. See Output window for details.');
                kubeChannel.showOutput(stderr, 'Docker');
                console.log(stderr);
            }
        });
    });
}

function findKindName() {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor!');
        return null; // No open text editor
    }
    let text = editor.document.getText();
    return findKindNameForText(text);
}

function findKindNameForText(text) {
    try {
        let obj = yaml.safeLoad(text);
        if (!obj || !obj.kind) {
            return null;
        }
        if (!obj.metadata || !obj.metadata.name) {
            return null;
        }
        return obj.kind.toLowerCase() + '/' + obj.metadata.name;
    } catch (ex) {
        console.log(ex);
        return null;
    }
}

function findKindNameOrPrompt(resourceKinds : kuberesources.ResourceKind[], descriptionVerb, opts, handler) {
    let kindName = findKindName();
    if (kindName === null) {
        promptKindName(resourceKinds, descriptionVerb, opts, handler);
    } else {
        handler(kindName);
    }
}

function promptKindName(resourceKinds : kuberesources.ResourceKind[], descriptionVerb, opts, handler) {
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

function quickPickKindName(resourceKinds : kuberesources.ResourceKind[], opts, handler) {
    vscode.window.showQuickPick(resourceKinds).then((resourceKind) => {
        if (resourceKind) {
            let kind = resourceKind.abbreviation;
            kubectl.invoke("get " + kind, (code, stdout, stderr) => {
                if (code === 0) {
                    let names = parseNamesFromKubectlLines(stdout);
                    if (names.length > 0) {
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
                    } else {
                        vscode.window.showInformationMessage("No resources of type " + resourceKind.displayName + " in cluster");
                    }
                } else {
                    vscode.window.showErrorMessage(stderr);
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

function findPod(callback) {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor!');
        return null; // No open text editor
    }

    let text = editor.document.getText();
    try {
        let obj = yaml.safeLoad(text);
        if (obj.kind !== 'Pod') {
            return;
        }

        callback({
            name: obj.metadata.name,
            namespace: obj.metadata.namespace
        });
        return;
    } catch (ex) {
        // pass
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

function selectPodForApp(callback) {
    findPodsForApp((podList) => {
        if (podList.items.length === 0) {
            vscode.window.showErrorMessage('Couldn\'t find any relevant pods.');
            callback(null);
            return;
        }
        if (podList.items.length === 1) {
            callback(podList.items[0]);
            return;
        }
        let names = [];

        for (const element of podList) {
            names.push(`${element.metadata.namespace}/${element.metadata.name}`);
        }

        vscode.window.showQuickPick(names).then((value) => {
            if (!value) {
                callback(null);
                return;
            }

            let ix = value.indexOf('/');
            let name = value.substring(ix + 1);

            for (const element of podList) {
                if (element.name !== name) {
                    continue;
                }

                callback(element);
                return;
            }

            callback(null);
        });
    });
}

function logsKubernetes(explorerNode? : explorer.ResourceNode) {
    if (explorerNode) {
        getLogsCore(explorerNode.id);  // TODO: we don't know if there is a namespace in this case - is that a problem?
    } else {
        findPod(getLogs);
    }
}

function getLogs(pod) {
    if (!pod) {
        vscode.window.showErrorMessage('Can\'t find a pod!');
        return;
    }
    getLogsCore(pod.name, pod.namespace);

}

function getLogsCore(podName : string, podNamespace? : string) {
    // TODO: Support multiple containers here!
    let cmd = ' logs ' + podName;
    if (podNamespace && podNamespace.length > 0) {
        cmd += ' --namespace=' + podNamespace;
    }
    const fn = kubectlOutputTo(podName + '-logs');
    kubectl.invokeWithProgress(cmd, 'Loading logs...', fn);
}

function kubectlOutputTo(name : string) {
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

function describeKubernetes(explorerNode? : explorer.ResourceNode) {
    if (explorerNode) {
        describeKubernetesCore(explorerNode.resourceId);
    } else {
        findKindNameOrPrompt(kuberesources.commonKinds, 'describe', { nameOptional: true }, (value) => {
            describeKubernetesCore(value);
        });
    }
}

function describeKubernetesCore(kindName : string) {
    const fn = kubectlOutputTo(kindName + "-describe");
    kubectl.invokeWithProgress(' describe ' + kindName, `Describing ${kindName}...`, fn);
}

function selectContainerForPod(pod, callback) {
    if (!pod) {
        callback(null);
    }
    if (pod.spec.containers.length === 1) {
        callback(pod.spec.containers[0]);
        return;
    }
    let names = [];

    for (const element of pod.spec.containers) {
        names.push(element.name);
    }

    vscode.window.showQuickPick(names).then((value) => {
        for (const element of pod.spec.containers) {
            if (element.name !== value) {
                continue;
            }

            callback(element);
            return;
        }

        callback(null);
    });
}

function execKubernetes() {
    execKubernetesCore(false);
}

async function terminalKubernetes(explorerNode? : explorer.ResourceNode) {
    if (explorerNode) {
        // For those images (e.g. built from Busybox) where bash may not be installed by default, use sh instead.
        const isBash = await isBashOnPod(explorerNode.id);
        execTerminalOnPod(explorerNode.id, isBash ? 'bash' : 'sh');
    } else {
        execKubernetesCore(true);
    }
}

function execKubernetesCore(isTerminal) {
    let opts: any = { prompt: 'Please provide a command to execute' };

    if (isTerminal) {
        opts.value = 'bash';
    }

    vscode.window.showInputBox(
        opts
    ).then((cmd) => {
        if (!cmd || cmd.length === 0) {
            return;
        }

        selectPodForApp((pod) => {
            if (!pod || !pod.metadata) {
                return;
            }

            if (isTerminal) {
                execTerminalOnPod(pod.metadata.name, cmd);
                return;
            }

            const execCmd = ' exec ' + pod.metadata.name + ' ' + cmd;
            const fn = kubectlOutputTo(pod.metadata.name + '-exec');
            kubectl.invoke(execCmd, fn);
        });
    });
}

function execTerminalOnPod(podName : string, terminalCmd : string) {
    const terminalExecCmd : string[] = ['exec', '-it', podName, '--', terminalCmd];
    const term = vscode.window.createTerminal(`${terminalCmd} on ${podName}`, kubectl.path(), terminalExecCmd);
    term.show();
}

async function isBashOnPod(podName : string): Promise<boolean> {
    const result = await kubectl.invokeAsync(`exec ${podName} -- ls -la /bin/bash`);
    return !result.code;
}

function syncKubernetes() {
    selectPodForApp((pod) => {
        selectContainerForPod(pod, (container) => {
            let pieces = container.image.split(':');
            if (pieces.length !== 2) {
                vscode.window.showErrorMessage(`unexpected image name: ${container.image}`);
                return;
            }

            const cmd = `git checkout ${pieces[1]}`;

            //eslint-disable-next-line no-unused-vars
            shell.execCore(cmd, shell.execOpts()).then(({code, stdout, stderr}) => {
                if (code !== 0) {
                    vscode.window.showErrorMessage(`git checkout returned: ${code}`);
                    return 'error';
                }
            });
        });
    });
}

const deleteKubernetes = async (explorerNode? : explorer.ResourceNode) => {
    if (explorerNode) {
        const answer = await vscode.window.showWarningMessage(`Do you want to delete the resource '${explorerNode.resourceId}'?`, ...deleteMessageItems);
        if (answer.isCloseAffordance) {
            return;
        }
        const shellResult = await kubectl.invokeAsyncWithProgress(`delete ${explorerNode.resourceId}`, `Deleting ${explorerNode.resourceId}...`);
        if (shellResult.code !== 0) {
            await vscode.window.showErrorMessage(`Failed to delete resource '${explorerNode.resourceId}': ${shellResult.stderr}`);
            return;
        } else {
            await vscode.window.showInformationMessage(shellResult.stdout);
            return await vscode.commands.executeCommand("extension.vsKubernetesRefreshExplorer");
        }
    } else {
        findKindNameOrPrompt(kuberesources.commonKinds, 'delete', { nameOptional: true }, async (kindName) => {
            if (kindName) {
                let commandArgs = kindName;
                if (!containsName(kindName)) {
                    commandArgs = kindName + " --all";
                }
                const shellResult = await kubectl.invokeAsyncWithProgress(`delete ${commandArgs}`, `Deleting ${kindName}...`);
                if (shellResult.code !== 0) {
                    await vscode.window.showErrorMessage(`Failed to delete resource '${kindName}': ${shellResult.stderr}`);
                    return;
                } else {
                    await vscode.window.showInformationMessage(shellResult.stdout);
                    return await vscode.commands.executeCommand("extension.vsKubernetesRefreshExplorer");
                }
            }
        });
    }
};

const applyKubernetes = () => {
    diffKubernetes(() => {
        vscode.window.showInformationMessage(
            'Do you wish to apply this change?',
            'Apply'
        ).then((result) => {
            if (result !== 'Apply') {
                return;
            }

            maybeRunKubernetesCommandForActiveWindow('apply -f');
        });
    });
};

const handleError = (err) => {
    if (err) {
        vscode.window.showErrorMessage(err);
    }
};

const diffKubernetes = (callback) => {
    getTextForActiveWindow((data, file) => {
        console.log(data, file);
        let kindName = null;
        let fileName = null;

        if (data) {
            kindName = findKindNameForText(data);
            fileName = path.join(os.tmpdir(), 'local.json');
            fs.writeFile(fileName, data, handleError);
        } else if (file) {
            kindName = findKindName();
            fileName = file;
        } else {
            vscode.window.showInformationMessage('Nothing to diff.');
            return;
        }

        if (!kindName) {
            vscode.window.showWarningMessage('Could not find a valid API object');
            return;
        }

        kubectl.invoke(` get -o json ${kindName}`, (result, stdout, stderr) => {
            if (result !== 0) {
                vscode.window.showErrorMessage('Error running command: ' + stderr);
                return;
            }

            let otherFile = path.join(os.tmpdir(), 'server.json');
            fs.writeFile(otherFile, stdout, handleError);

            vscode.commands.executeCommand(
                'vscode.diff',
                vscode.Uri.parse('file://' + otherFile),
                vscode.Uri.parse('file://' + fileName)).then((result) => {
                    console.log(result);
                    if (!callback) {
                        return;
                    }

                    callback();
                });
        });
    });
};

const debugKubernetes = () => {
    buildPushThenExec(_debugInternal);
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

const _doDebug = (name, image, cmd) => {
    const deploymentName = `${name}-debug`;
    const runCmd = `run ${deploymentName} --image=${image} -i --attach=false -- ${cmd}`;
    console.log(runCmd);

    kubectl.invoke(runCmd, (result, stdout, stderr) => {
        if (result !== 0) {
            vscode.window.showErrorMessage('Failed to start debug container: ' + stderr);
            return;
        }

        findDebugPodsForApp((podList) => {
            if (podList.items.length === 0) {
                vscode.window.showErrorMessage('Failed to find debug pod.');
                return;
            }

            let podName = podList.items[0].metadata.name;
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

async function configureFromClusterKubernetes(request? : WizardUIRequest) {
    if (request) {
        await configureFromClusterUI.next(request);
    } else {
        const newId : string = uuid.v4();
        configureFromClusterUI.start(newId);
        vscode.commands.executeCommand('vscode.previewHtml', configureFromCluster.operationUri(newId), 2, "Configure Kubernetes");
        await configureFromClusterUI.next({ operationId: newId, requestData: undefined });
    }
}

async function createClusterKubernetes(request? : WizardUIRequest) {
    if (request) {
        await createClusterUI.next(request);
    } else {
        const newId : string = uuid.v4();
        createClusterUI.start(newId);
        vscode.commands.executeCommand('vscode.previewHtml', createCluster.operationUri(newId), 2, "Create Kubernetes Cluster");
        await createClusterUI.next({ operationId: newId, requestData: undefined });
    }
}

async function useContextKubernetes(explorerNode: explorer.ResourceNode) {
    const targetContext = explorerNode.metadata.context;
    const shellResult = await kubectl.invokeAsync(`config use-context ${targetContext}`);
    if (shellResult.code === 0) {
        return vscode.commands.executeCommand("extension.vsKubernetesRefreshExplorer");
    } else {
        vscode.window.showErrorMessage(`Failed to set '${targetContext}' as current cluster: ${shellResult.stderr}`);
    }
}

async function clusterInfoKubernetes(explorerNode: explorer.ResourceNode) {
    const targetContext = explorerNode.metadata.context;
    const shellResult = await kubectl.invokeAsync(`cluster-info`);
    if (shellResult.code === 0) {
        kubeChannel.showOutput(shellResult.stdout, `cluster-info for ${explorerNode.resourceId}`);
    } else {
        vscode.window.showErrorMessage(`Failed to get cluster info: ${shellResult.stderr}`);
    }
}

async function deleteContextKubernetes(explorerNode: explorer.ResourceNode) {
    const answer = await vscode.window.showWarningMessage(`Do you want to delete the cluser '${explorerNode.id}' from the kubeconfig?`, ...deleteMessageItems);
    if (answer.isCloseAffordance) {
        return;
    }
    if (await kubectlUtils.deleteCluster(kubectl, explorerNode.metadata)) {
        return vscode.commands.executeCommand("extension.vsKubernetesRefreshExplorer");
    }
}

async function useNamespaceKubernetes(explorerNode: explorer.KubernetesObject) {
    if (await kubectlUtils.switchNamespace(kubectl, explorerNode.id)) {
        return vscode.commands.executeCommand("extension.vsKubernetesRefreshExplorer");
    }
}

async function execDraftVersion() {
    if (!(await draft.checkPresent())) {
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
    if (!(await draft.checkPresent())) {
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

async function execDraftCreateApp(appName : string, pack? : string) : Promise<void> {
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

function draftCreateResult(sr : ShellResult, hadPack : boolean) {
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
    if (!(await draft.checkPresent())) {
        return;
    }

    // if it's already running... how can we tell?
    const draftPath = await draft.path();
    if (shell.isUnix()) {
        const term = vscode.window.createTerminal('draft up', `bash`, [ '-c', `${draftPath} up ; bash` ]);
        term.show(true);
    } else {
        const term = vscode.window.createTerminal('draft up', 'powershell.exe', [ '-NoExit', `${draftPath}`, `up` ]);
        term.show(true);
    }
}

function editorIsActive(): boolean {
    // force type coercion
    return (vscode.window.activeTextEditor) ? true : false;
}
