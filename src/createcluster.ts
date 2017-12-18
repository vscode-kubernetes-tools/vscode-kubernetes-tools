'use strict';

import { TextDocumentContentProvider, Uri, EventEmitter, Event, ProviderResult, CancellationToken } from 'vscode';
import { Shell } from './shell';
import { FS } from './fs';
import { Advanceable, Errorable, UIRequest, StageData, OperationState, OperationMap, advanceUri as wizardAdvanceUri, selectionChangedScript as wizardSelectionChangedScript, script, waitScript } from './wizard';
import { error } from 'util';

export const uriScheme : string = "k8screatecluster";

export function operationUri(operationId: string) : Uri {
    return Uri.parse(`${uriScheme}://operations/${operationId}`);
}

export function uiProvider(fs: FS, shell: Shell) : TextDocumentContentProvider & Advanceable {
    return new UIProvider(fs, shell);
}

enum OperationStage {
    Initial,
    PromptForClusterType,
    AzurePromptForSubscription,
    InternalError,
    Complete,
}

interface Context {
    readonly fs: FS;
    readonly shell: Shell;
}

// TODO: feels like we should be able to deduplicate this with the ACS UI provider
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
                stage: OperationStage.PromptForClusterType,
            };
        case OperationStage.PromptForClusterType:
            const selectedClusterType : string = requestData;
            if (selectedClusterType == 'Azure Kubernetes Service' || selectedClusterType == 'Azure Container Service') {
                return {
                    last: await getSubscriptionList(context),
                    stage: OperationStage.AzurePromptForSubscription
                };
            } else {
                return {
                    last: unsupportedClusterType(selectedClusterType),
                    stage: OperationStage.InternalError
                };
            }
        case OperationStage.AzurePromptForSubscription:
            const selectedSubscription : string = requestData;
            return {
                last: { actionDescription: 'fie', result: { succeeded: true, result: selectedSubscription, error: [] } },
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
    // list subs
    const clusterTypes = [
        'Azure Kubernetes Service',
        'Azure Container Service',
        'Honest Johns All-Reliable Bargain Kubernetes Hosting'
    ];
    return {
        actionDescription: 'listing cluster types',
        result: { succeeded: true, result: clusterTypes, error: [] }
    };
}

// TODO: this is an exact duplicate of code in acs.ts

async function getSubscriptionList(context: Context) : Promise<StageData> {
    // check for prerequisites
    const prerequisiteErrors = await verifyPrerequisitesAsync(context);
    if (prerequisiteErrors.length > 0) {
        return {
            actionDescription: 'checking prerequisites',
            result: { succeeded: false, result: false, error: prerequisiteErrors }
        };
    }

    // list subs
    const subscriptions = await listSubscriptionsAsync(context);
    return {
        actionDescription: 'listing subscriptions',
        result: subscriptions
    };
}

async function verifyPrerequisitesAsync(context: Context) : Promise<string[]> {
    const errors = new Array<string>();
    
    const sr = await context.shell.exec('az --help');
    if (sr.code !== 0 || sr.stderr) {
        errors.push('Azure CLI 2.0 not found - install Azure CLI 2.0 and log in');
    }

    prereqCheckSSHKeys(context, errors);

    return errors;
}

function prereqCheckSSHKeys(context: Context, errors: Array<String>) {
    const sshKeyFile = context.shell.combinePath(context.shell.home(), '.ssh/id_rsa');
    if (!context.fs.existsSync(sshKeyFile)) {
        errors.push('SSH keys not found - expected key file at ' + sshKeyFile);
    }
}

async function listSubscriptionsAsync(context: Context) : Promise<Errorable<string[]>> {
    const sr = await context.shell.exec("az account list --all --query [*].name -ojson");
    
    if (sr.code === 0 && !sr.stderr) {  // az account list returns exit code 0 even if not logged in
        const accountNames : string[] = JSON.parse(sr.stdout);
        return { succeeded: true, result: accountNames, error: [] };
    } else {
        return { succeeded: false, result: [], error: [sr.stderr] };
    }
}

// end TODO

function render(operationId: string, state: OperationState<OperationStage>) : string {
    switch (state.stage) {
        case OperationStage.Initial:
             return renderInitial();
        case OperationStage.PromptForClusterType:
            return renderPromptForClusterType(operationId, state.last);
        case OperationStage.AzurePromptForSubscription:
            return renderPromptForSubscription(operationId, state.last);
        case OperationStage.InternalError:
           return renderInternalError(state.last);
        case OperationStage.Complete:
            return renderComplete(state.last);
        default:
            return internalError(`Unknown operation stage ${state.stage}`);
    }
}

function renderInitial() : string {
    return '<!-- Initial --><h1>Listing cluster types</h1><p>Please wait...</p>';
}

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

// TODO: duplicate of code in acs.ts
function renderPromptForSubscription(operationId: string, last: StageData) : string {
    if (!last.result.succeeded) {
        return notifyCliError('PromptForSubscription', last);
    }
    const subscriptions : string[] = last.result.result;
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

function renderComplete(last: StageData) : string {
    const title = last.result.succeeded ? 'Creating cluster' : `Error ${last.actionDescription}`;
    const createResult = last.result.result;
    const clusterType = createResult as string;
    const message = `<p>You chose ${clusterType}</p>`;
    return `<!-- Complete -->
            <h1>${title}</h1>
            ${styles()}
            ${message}`;
}

function renderInternalError(last: StageData) : string {
    return internalError(last.result.error[0]);
}

// TODO: consider consolidating notifyCliError, notifyNoOptions, internalError() and styles() with acs
function notifyCliError(stageId: string, last: StageData) : string {
    return `<!-- ${stageId} -->
        <h1>Error ${last.actionDescription}</h1>
        <p><span class='error'>The Azure command line failed.</span>  See below for the error message.  You may need to:</p>
        <ul>
        <li>Log into the Azure CLI (run az login in the terminal)</li>
        <li>Install the Azure CLI <a href='https://docs.microsoft.com/cli/azure/install-azure-cli'>(see the instructions for your operating system)</a></li>
        <li>Configure Kubernetes from the command line using the az acs command</li>
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

function styles() : string {
    return `
<style>
.vscode-light a {
    color: navy;
}

.vscode-dark a {
    color: azure;
}

.vscode-light .error {
    color: red;
    font-weight: bold;
}

.vscode-dark .error {
    color: red;
    font-weight: bold;
}

.vscode-light .success {
    color: green;
    font-weight: bold;
}

.vscode-dark .success {
    color: darkseagreen;
    font-weight: bold;
}
</style>
`;
}

const commandName = 'vsKubernetesCreateCluster';

function advanceUri(operationId: string, requestData: string) : string {
    return wizardAdvanceUri(commandName, operationId, requestData);
}

function selectionChangedScript(operationId: string) : string {
    return wizardSelectionChangedScript(commandName, operationId);
}

