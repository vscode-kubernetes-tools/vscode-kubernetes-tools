'use strict';

import { TextDocumentContentProvider, Uri, EventEmitter, Event, ProviderResult, CancellationToken } from 'vscode';
import { Shell } from './shell';
import { FS } from './fs';
import { Advanceable, Errorable, UIRequest, StageData, OperationState, OperationMap, advanceUri as wizardAdvanceUri, selectionChangedScript as wizardSelectionChangedScript, script, waitScript, styles, extend } from './wizard';
import { Context, getSubscriptionList, setSubscriptionAsync, configureCluster, getClusterCommand, getClusterCommandAndSubcommand } from './azure';

export const uriScheme : string = "k8sconfigure";

export function operationUri(operationId: string) : Uri {
    return Uri.parse(`${uriScheme}://operations/${operationId}`);
}

export function uiProvider(fs: FS, shell: Shell) : TextDocumentContentProvider & Advanceable {
    return new UIProvider(fs, shell);
}

enum OperationStage {
    Initial,
    PromptForClusterType,
    PromptForSubscription,
    PromptForCluster,
    InternalError,
    Complete,
}

class UIProvider implements TextDocumentContentProvider, Advanceable {

    private readonly context;

    constructor(fs: FS, shell: Shell) {
        this.context = { fs: fs, shell: shell };
    }

	private _onDidChange: EventEmitter<Uri> = new EventEmitter<Uri>();
    readonly onDidChange: Event<Uri> = this._onDidChange.event;

    private operations: OperationMap<OperationStage> = new OperationMap<OperationStage>();

    provideTextDocumentContent(uri: Uri, token: CancellationToken) : ProviderResult<string> {
        const operationId = uri.path.substr(1);
        const operationState = this.operations.get(operationId);
        return render(operationId, operationState);
    }

    start(operationId: string): void {
        const initialStage = {
            stage: OperationStage.Initial,
            last: {
                actionDescription: '',
                result: { succeeded: true, result: null, error: [] }
            }
        };
        this.operations.set(operationId, initialStage);
        this._onDidChange.fire(operationUri(operationId));
    }

    async next(request: UIRequest): Promise<void> {
        const operationId = request.operationId;
        const sourceState = this.operations.get(operationId);
        const result = await next(this.context, sourceState, request.requestData);
        this.operations.set(operationId, result);
        this._onDidChange.fire(operationUri(operationId));
    }
}

async function next(context: Context, sourceState: OperationState<OperationStage>, requestData: string) : Promise<OperationState<OperationStage>> {
    switch (sourceState.stage) {
        case OperationStage.Initial:
            return {
                last: listClusterTypes(),
                stage: OperationStage.PromptForClusterType
            };
        case OperationStage.PromptForClusterType:
            const selectedClusterType : string = requestData;
            if (selectedClusterType == 'Azure Kubernetes Service' || selectedClusterType == 'Azure Container Service') {
                const subscriptions = await getSubscriptionList(context, getClusterCommand(selectedClusterType));
                if (!subscriptions.result.succeeded) {
                    return {
                        last: subscriptions,
                        stage: OperationStage.PromptForSubscription
                    };
                }
                const pctStateInfo = extend(subscriptions.result, (subs) => { return { clusterType: selectedClusterType, subscriptions: subs }; });
                return {
                    last: { actionDescription: 'selecting cluster type', result: pctStateInfo },
                    stage: OperationStage.PromptForSubscription
                };
            } else {
                return {
                    last: unsupportedClusterType(selectedClusterType),
                    stage: OperationStage.InternalError
                };
            }
        case OperationStage.PromptForSubscription:
            const selectedSubscription : string = requestData;
            const clusterType : string = sourceState.last.result.result.clusterType;
            const clusterList = await getClusterList(context, selectedSubscription, clusterType);
            const psStateInfo = extend(clusterList.result, (cl) => {return {clusterType: clusterType, clusterList: cl};});
            const psStageData = {
                last: {
                    actionDescription: clusterList.actionDescription,
                    result: psStateInfo
                },
                stage: OperationStage.PromptForCluster
            };
            return psStageData;
        case OperationStage.PromptForCluster:
            const selectedCluster = parseCluster(requestData);
            const clusterTypeEncore : string = sourceState.last.result.result.clusterType;  // TODO: rename
            return {
                last: await configureCluster(context, clusterTypeEncore, selectedCluster.name, selectedCluster.resourceGroup),
                stage: OperationStage.Complete
            };
        default:
            return {
                stage: sourceState.stage,
                last: sourceState.last
            };
    }
}

function unsupportedClusterType(clusterType: string) : StageData {
    return {
        actionDescription: 'selecting cluster type',
        result: { succeeded: false, result: '', error: ['Unsupported cluster type ' + clusterType] }
    };
}

function listClusterTypes() : StageData {
    const clusterTypes = [
        'Azure Kubernetes Service',
        'Azure Container Service'
    ];
    return {
        actionDescription: 'listing cluster types',
        result: { succeeded: true, result: clusterTypes, error: [] }
    };
}

function formatCluster(cluster: any) : string {
    return cluster.resourceGroup + '/' + cluster.name;
}

function parseCluster(encoded: string) {
    if (!encoded) {
        return { resourceGroup: '', name: '' };  // TODO: this should never happen - fix tests to make it so it doesn't!
    }
    const delimiterPos = encoded.indexOf('/');
    return {
        resourceGroup: encoded.substr(0, delimiterPos),
        name: encoded.substr(delimiterPos + 1)
    };
}

async function getClusterList(context: Context, subscription: string, clusterType: string) : Promise<StageData> {
    // log in
    const login = await setSubscriptionAsync(context, subscription);
    if (!login.succeeded) {
        return {
            actionDescription: 'logging into subscription',
            result: login
        };
    }

    // list clusters
    const clusters = await listClustersAsync(context, clusterType);
    return {
        actionDescription: 'listing clusters',
        result: clusters
    };
}

function render(operationId: string, state: OperationState<OperationStage>) : string {
    switch (state.stage) {
        case OperationStage.Initial:
             return renderInitial();
        case OperationStage.PromptForClusterType:
            return renderPromptForClusterType(operationId, state.last);
        case OperationStage.PromptForSubscription:
            return renderPromptForSubscription(operationId, state.last);
        case OperationStage.PromptForCluster:
            return renderPromptForCluster(operationId, state.last);
        case OperationStage.Complete:
            return renderComplete(state.last);
        case OperationStage.InternalError:
            return renderInternalError(state.last);
         default:
            return internalError(`Unknown operation stage ${state.stage}`);
    }
}

// TODO: Using HTML comments to test that the correct rendering was invoked.
// Would be 'purer' to allow the tests to inject fake rendering methods, as this
// would also allow us to check the data being passed into the rendering method...

function renderInitial() : string {
    return '<!-- Initial --><h1>Listing cluster types</h1><p>Please wait...</p>';
}

// TODO: (near-?) duplicate of function in createcluster.ts
function renderPromptForClusterType(operationId: string, last: StageData) : string {
    const clusterTypes : string[] = last.result.result;
    const initialUri = advanceUri(operationId, clusterTypes[0]);
    const options = clusterTypes.map((s) => `<option value="${s}">${s}</option>`).join('\n');
    return `<!-- PromptForClusterType -->
            <h1 id='h'>Choose cluster type</h1>
            ${styles()}
            ${waitScript('Contacting cloud')}
            ${selectionChangedScript(operationId)}
            <div id='content'>
            <p>
            Cluster type: <select id='selector' onchange='selectionChanged()'>
            ${options}
            </select>
            </p>

            <p>
            <a id='nextlink' href='${initialUri}' onclick='promptWait()'>Next &gt;</a>
            </p>
            </div>`;
}

function renderPromptForSubscription(operationId: string, last: StageData) : string {
    if (!last.result.succeeded) {
        return notifyCliError('PromptForSubscription', last);
    }
    const subscriptions : string[] = last.result.result.subscriptions;
    if (!subscriptions || subscriptions.length === 0) {
        return notifyNoOptions('PromptForSubscription', 'No subscriptions', 'There are no Azure subscriptions associated with your Azure login.');
    }
    const initialUri = advanceUri(operationId, subscriptions[0]);
    const options = subscriptions.map((s) => `<option value="${s}">${s}</option>`).join('\n');
    return `<!-- PromptForSubscription -->
            <h1 id='h'>Choose subscription</h1>
            ${styles()}
            ${waitScript('Listing clusters')}
            ${selectionChangedScript(operationId)}
            <div id='content'>
            <p>
            Azure subscription: <select id='selector' onchange='selectionChanged()'>
            ${options}
            </select>
            </p>

            <p><b>Important! The selected subscription will be set as the active subscription for the Azure CLI.</b></p>

            <p>
            <a id='nextlink' href='${initialUri}' onclick='promptWait()'>Next &gt;</a>
            </p>
            </div>`;
}

function renderPromptForCluster(operationId: string, last: StageData) : string {
    if (!last.result.succeeded) {
        return notifyCliError('PromptForCluster', last);
    }
    const clusters : any[] = last.result.result.clusterList;
    if (!clusters || clusters.length === 0) {
        return notifyNoOptions('PromptForCluster', 'No clusters', 'There are no Kubernetes clusters in the selected subscription.');
    }
    const initialUri = advanceUri(operationId, formatCluster(clusters[0]));
    const options = clusters.map((c) => `<option value="${formatCluster(c)}">${c.name} (in ${c.resourceGroup})</option>`).join('\n');
    return `<!-- PromptForCluster -->
            <h1 id='h'>Choose cluster</h1>
            ${styles()}
            ${waitScript('Configuring Kubernetes')}
            ${selectionChangedScript(operationId)}
            <div id='content'>
            <p>
            Kubernetes cluster: <select id='selector' onchange='selectionChanged()'>
            ${options}
            </select>
            </p>

            <p>
            <a id='nextlink' href='${initialUri}' onclick='promptWait()'>Next &gt;</a>
            </p>
            </div>`;
}

function renderComplete(last: StageData) : string {
    const title = last.result.succeeded ? 'Configuration completed' : `Error ${last.actionDescription}`;
    const configResult = last.result.result;
    const pathMessage = configResult.cliOnDefaultPath ? '' :
        '<p>This location is not on your system PATH. Add this directory to your path, or set the VS Code <b>vs-kubernetes.kubectl-path</b> config setting.</p>';
    const getCliOutput = configResult.gotCli ?
        `<p class='success'>kubectl installed at ${configResult.cliInstallFile}</p>${pathMessage}` :
        `<p class='error'>An error occurred while downloading kubectl.</p>
         <p><b>Details</b></p>
         <p>${configResult.cliError}</p>`;
    const getCredsOutput = last.result.result.gotCredentials ?
        `<p class='success'>Successfully configured kubectl with Azure Container Service cluster credentials.</p>` :
        `<p class='error'>An error occurred while getting Azure Container Service cluster credentials.</p>
         <p><b>Details</b></p>
         <p>${configResult.credentialsError}</p>`;
    return `<!-- Complete -->
            <h1>${title}</h1>
            ${styles()}
            ${getCliOutput}
            ${getCredsOutput}`;
}

function renderInternalError(last: StageData) : string {
    return internalError(last.result.error[0]);
}

function notifyCliError(stageId: string, last: StageData) : string {
    return `<!-- ${stageId} -->
        <h1>Error ${last.actionDescription}</h1>
        <p><span class='error'>The Azure command line failed.</span>  See below for the error message.  You may need to:</p>
        <ul>
        <li>Log into the Azure CLI (run az login in the terminal)</li>
        <li>Install the Azure CLI <a href='https://docs.microsoft.com/cli/azure/install-azure-cli'>(see the instructions for your operating system)</a></li>
        <li>Configure Kubernetes from the command line using the az acs or az aks command</li>
        </ul>
        <p><b>Details</b></p>
        <p>${last.result.error}</p>`;
}

function notifyNoOptions(stageId: string, title: string, message: string) : string {
    return `
<h1>${title}</h1>
${styles()}
<p class='error'>${message}</p>
`;
}

function internalError(error: string) : string {
    return `
<h1>Internal extension error</h1>
${styles()}
<p class='error'>An internal error occurred in the vscode-kubernetes-tools extension.</p>
<p>This is not an Azure or Kubernetes issue.  Please report error text '${error}' to the extension authors.</p>
`;
}

const commandName = 'vsKubernetesConfigureFromCluster';

function selectionChangedScript(operationId: string) : string {
    return wizardSelectionChangedScript(commandName, operationId);
}

function advanceUri(operationId: string, requestData: string) : string {
    return wizardAdvanceUri(commandName, operationId, requestData);
}

async function listClustersAsync(context: Context, clusterType: string) : Promise<Errorable<string[]>> {
    let cmd = getListClustersCommand(context, clusterType);
    const sr = await context.shell.exec(cmd);

    if (sr.code === 0 && !sr.stderr) {
        const clusters : any[] = JSON.parse(sr.stdout);
        return { succeeded: true, result: clusters, error: [] };
    } else {
        return { succeeded: false, result: [], error: [sr.stderr] };
    }
}

function listClustersFilter(clusterType: string): string {
    if (clusterType == 'Azure Container Service') {
        return '?orchestratorProfile.orchestratorType==`Kubernetes`';
    }
    return '';
}

function getListClustersCommand(context: Context, clusterType: string) : string {
    let filter = listClustersFilter(clusterType);
    let query = `[${filter}].{name:name,resourceGroup:resourceGroup}`;
    if (context.shell.isUnix()) {
        query = `'${query}'`;
    }
    return `az ${getClusterCommand(clusterType)} list --query ${query} -ojson`;
}
