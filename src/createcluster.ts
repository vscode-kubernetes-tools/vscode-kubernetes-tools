'use strict';

import { TextDocumentContentProvider, Uri, EventEmitter, Event, ProviderResult, CancellationToken } from 'vscode';
import { Shell } from './shell';
import { FS } from './fs';
import { Advanceable, Errorable, UIRequest, StageData, OperationState, OperationMap, advanceUri as wizardAdvanceUri, selectionChangedScript as wizardSelectionChangedScript, selectionChangedScriptMulti as wizardSelectionChangedScriptMulti, script, waitScript, extend, ControlMapping, styles } from './wizard';
import { Context, getSubscriptionList, loginAsync, ServiceLocation, Locations } from './azure';
import { error } from 'util';

export const uriScheme : string = "k8screatecluster";

export function operationUri(operationId: string) : Uri {
    return Uri.parse(`${uriScheme}://operations/${operationId}`);
}

export function uiProvider(fs: FS, shell: Shell) : TextDocumentContentProvider & Advanceable {
    return new UIProvider(fs, shell);
}

// Sequence:
// * Which cloud?
//   * Which subscription?
//   * Cluster name, RG name (and check if RG exists cos we need to create it if not), location
//   * Master VM size, master count (ACS only - skip maybe?)
//   * Agent VM size, agent count, agent OS disk size (?)
//   * k8s version? (AKS = -k, ACS = --orchestrator-type + --orchestrator-release)
//   * az acs/aks create --no-wait

enum OperationStage {
    Initial,
    PromptForClusterType,
    AzurePromptForSubscription,
    AzurePromptForMetadata,
    AzurePromptForAgentSettings,
    InternalError,
    ExternalError,
    Complete,
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
                const subscriptions = await getSubscriptionList(context);
                const pctStateInfo = extend(subscriptions.result, (subs) => { return { clusterType: selectedClusterType, subscriptions: subs }; });
                return {
                    last: { actionDescription: 'selecting cluster type', result: pctStateInfo },
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
            const selectedClusterTypeEx = sourceState.last.result.result.clusterType;  // TODO: rename
            const serviceLocations = selectedClusterTypeEx == 'Azure Container Service' ?
                await listAcsLocations(context) :
                await listAksLocations(context);
            if (!serviceLocations.succeeded) {
                return {
                    last: { actionDescription: 'listing available regions', result: serviceLocations },
                    stage: OperationStage.ExternalError
                };
            }
            const psStateInfo = {clusterType: selectedClusterTypeEx, subscription: selectedSubscription, serviceLocations: serviceLocations.result };
            return {
                last: { actionDescription: 'selecting subscription', result: { succeeded: true, result: psStateInfo, error: [] } },
                stage: OperationStage.AzurePromptForMetadata
            };
        case OperationStage.AzurePromptForMetadata:
            const metadata = JSON.parse(requestData);
            const vmSizes = await listVMSizes(context, metadata.location);
            if (!vmSizes.succeeded) {
                return {
                    last: { actionDescription: 'listing available node sizes', result: vmSizes },
                    stage: OperationStage.ExternalError
                };
            }
            const pmStateInfo = extend(sourceState.last.result, (v) => Object.assign({}, v, {metadata: metadata, vmSizes: vmSizes.result}));
            return {
                last: { actionDescription: 'collecting cluster metadata', result: pmStateInfo },
                stage: OperationStage.AzurePromptForAgentSettings
            };
        case OperationStage.AzurePromptForAgentSettings:
            const agentSettings = JSON.parse(requestData);
            const pasStateInfo = extend(sourceState.last.result, (v) => Object.assign({}, v, {agentSettings: agentSettings}));
            const creationResult = await createCluster(context, pasStateInfo.result);
            return {
                last: creationResult,
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

async function listLocations(context: Context) : Promise<Errorable<Locations>> {
    let query = "[].{name:name,displayName:displayName}";
    if (context.shell.isUnix()) {
        query = `'${query}'`;
    }

    const sr = await context.shell.exec(`az account list-locations --query ${query} -ojson`);
    
    if (sr.code === 0 && !sr.stderr) {
        const response = JSON.parse(sr.stdout);
        let locations : any = {};
        for (const r of response) {
            locations[r.name] = r.displayName;
        }
        const result = { locations: locations };
        return { succeeded: true, result: result, error: [] };
    } else {
        return { succeeded: false, result: { locations: {} }, error: [sr.stderr] };
    }
}

async function listAcsLocations(context: Context) : Promise<Errorable<ServiceLocation[]>> {
    const locationInfo = await listLocations(context);
    if (!locationInfo.succeeded) {
        return { succeeded: false, result: [], error: locationInfo.error };
    }
    const locations = locationInfo.result;

    const sr = await context.shell.exec(`az acs list-locations -ojson`);
    
    if (sr.code === 0 && !sr.stderr) {
        const response = JSON.parse(sr.stdout);
        const result = locationDisplayNamesEx(response.productionRegions, response.previewRegions, locations) ;
        return { succeeded: true, result: result, error: [] };
    } else {
        return { succeeded: false, result: [], error: [sr.stderr] };
    }
}

async function listAksLocations(context: Context) : Promise<Errorable<ServiceLocation[]>> {
    const locationInfo = await listLocations(context);
    if (!locationInfo.succeeded) {
        return { succeeded: false, result: [], error: locationInfo.error };
    }
    const locations = locationInfo.result;

    // There's no CLI for this, so we have to hardwire it for now
    const productionRegions = [];
    const previewRegions = ["centralus", "eastus", "westeurope"];
    const result = locationDisplayNamesEx(productionRegions, previewRegions, locations);
    return { succeeded: true, result: result, error: [] };
}

function locationDisplayNames(names: string[], preview: boolean, locationInfo: Locations) : ServiceLocation[] {
    return names.map((n) => { return { displayName: locationInfo.locations[n], isPreview: preview }; });
}

function locationDisplayNamesEx(production: string[], preview: string[], locationInfo: Locations) : ServiceLocation[] {
    let result = locationDisplayNames(production, false, locationInfo) ;
    result = result.concat(locationDisplayNames(preview, true, locationInfo));
    return result;
}

async function listVMSizes(context: Context, location: string) : Promise<Errorable<string[]>> {
    const sr = await context.shell.exec(`az vm list-sizes -l "${location}" -ojson`);
    
    if (sr.code === 0 && !sr.stderr) {
        const response : any[] = JSON.parse(sr.stdout);
        const result = response.map((r) => r.name as string);
        return { succeeded: true, result: result, error: [] };
    } else {
        return { succeeded: false, result: [], error: [sr.stderr] };
    }
}

async function resourceGroupExists(context: Context, resourceGroupName: string) : Promise<boolean> {
    const sr = await context.shell.exec(`az group show -n "${resourceGroupName}" -ojson`);
    
    if (sr.code === 0 && !sr.stderr) {
        return sr.stdout !== null && sr.stdout.length > 0;
    } else {
        return false;
    }
}

async function ensureResourceGroupAsync(context: Context, resourceGroupName: string, location: string) : Promise<Errorable<void>> {
    if (await resourceGroupExists(context, resourceGroupName)) {
        return { succeeded: true, result: null, error: [] };
    }

    const sr = await context.shell.exec(`az group create -n "${resourceGroupName}" -l "${location}"`);

    if (sr.code === 0 && !sr.stderr) {
        return { succeeded: true, result: null, error: [] };
    } else {
        return { succeeded: false, result: null, error: [sr.stderr] };
    }
}

async function execCreateClusterCmd(context: Context, options: any) : Promise<Errorable<void>> {
    let clusterCmd = 'aks';
    if (options.clusterType == 'Azure Container Service') {
        clusterCmd = 'acs';
    }
    let createCmd = `az ${clusterCmd} create -n "${options.metadata.clusterName}" -g "${options.metadata.resourceGroupName}" -l "${options.metadata.location}" --no-wait `;
    if (clusterCmd == 'acs') {
        createCmd = createCmd + `--agent-count ${options.agentSettings.count} --agent-vm-size "${options.agentSettings.vmSize}" -t Kubernetes`;
    } else {
        createCmd = createCmd + `--node-count ${options.agentSettings.count} --node-vm-size "${options.agentSettings.vmSize}"`;
    }
    
    const sr = await context.shell.exec(createCmd);

    if (sr.code === 0 && !sr.stderr) {
        return { succeeded: true, result: null, error: [] };
    } else {
        return { succeeded: false, result: null, error: [sr.stderr] };
    }
}

async function createCluster(context: Context, options: any) : Promise<StageData> {
    const description = `
    Created ${options.clusterType} cluster ${options.metadata.clusterName} in ${options.metadata.resourceGroupName} with ${options.agentSettings.count} agents.
    `;

    const login = await loginAsync(context, options.subscription);
    if (!login.succeeded) {
        return {
            actionDescription: 'logging into subscription',
            result: login
        };
    }

    const ensureResourceGroup = await ensureResourceGroupAsync(context, options.metadata.resourceGroupName, options.metadata.location);
    if (!ensureResourceGroup.succeeded) {
        return {
            actionDescription: 'ensuring resource group exists',
            result: ensureResourceGroup
        };
    }

    const createCluster = await execCreateClusterCmd(context, options);

    return {
        actionDescription: 'creating cluster',
        result: createCluster
    };
}

function render(operationId: string, state: OperationState<OperationStage>) : string {
    switch (state.stage) {
        case OperationStage.Initial:
             return renderInitial();
        case OperationStage.PromptForClusterType:
            return renderPromptForClusterType(operationId, state.last);
        case OperationStage.AzurePromptForSubscription:
            return renderPromptForSubscription(operationId, state.last);
        case OperationStage.AzurePromptForMetadata:
            return renderPromptForMetadata(operationId, state.last);
        case OperationStage.AzurePromptForAgentSettings:
            return renderPromptForAgentSettings(operationId, state.last);
        case OperationStage.InternalError:
           return renderInternalError(state.last);
        case OperationStage.InternalError:
           return renderExternalError(state.last);
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

// TODO: near-duplicate of code in acs.ts
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
            ${waitScript('Getting available regions')}
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

function renderPromptForMetadata(operationId: string, last: StageData) : string {
    if (!last.result.succeeded) {
        return notifyCliError('PromptForMetadata', last);
    }
    const serviceLocations : ServiceLocation[] = last.result.result.serviceLocations;
    const initialUri = advanceUri(operationId, `{"location":"${serviceLocations[0].displayName}","clusterName":"k8scluster","resourceGroupName":"k8scluster"}`);
    const options = serviceLocations.map((s) => `<option value="${s.displayName}">${s.displayName + (s.isPreview ? " (preview)" : "")}</option>`).join('\n');
    const mappings = [
        {ctrlName: "selector", extractVal: "locationCtrl.options[locationCtrl.selectedIndex].value", jsonKey: "location"},
        {ctrlName: "clustername", extractVal: "clusterNameCtrl.value", jsonKey: "clusterName"},
        {ctrlName: "resourcegroupname", extractVal: "resourceGroupNameCtrl.value", jsonKey: "resourceGroupName"}
    ];
    return `<!-- PromptForMetadata -->
            <h1 id='h'>Azure cluster settings</h1>
            ${styles()}
            ${waitScript('Getting available node sizes')}
            ${selectionChangedScriptMulti(operationId, mappings)}
            <div id='content'>
            <p>Cluster name: <input id='clustername' type='text' value='k8scluster' onchange='selectionChanged()'/>
            <p>Resource group name: <input id='resourcegroupname' type='text' value='k8scluster' onchange='selectionChanged()'/>
            <p>
            Location: <select id='selector' onchange='selectionChanged()'>
            ${options}
            </select>
            </p>

            <p>
            <a id='nextlink' href='${initialUri}' onclick='promptWait()'>Next &gt;</a>
            </p>
            </div>`;
}

function renderPromptForAgentSettings(operationId: string, last: StageData) : string {
    if (!last.result.succeeded) {
        return notifyCliError('PromptForAgentSettings', last);
    }
    const vmSizes : string[] = last.result.result.vmSizes;
    const defaultSize = "Standard_D2_v2";
    const initialUri = advanceUri(operationId, `{"vmSize": "${defaultSize}", "count": 3}`);
    const options = vmSizes.map((s) => `<option value="${s}" ${s == defaultSize ? "selected=true" : ""}>${s}</option>`).join('\n');
    const mappings = [
        {ctrlName: "selector", extractVal: "vmSizeCtrl.options[vmSizeCtrl.selectedIndex].value", jsonKey: "vmSize"},
        {ctrlName: "agentcount", extractVal: "countCtrl.value", jsonKey: "count"},
    ];
    return `<!-- PromptForAgentSettings -->
            <h1 id='h'>Azure agent settings</h1>
            ${styles()}
            ${waitScript('Creating cluster')}
            ${selectionChangedScriptMulti(operationId, mappings)}
            <div id='content'>
            <p>Agent count: <input id='agentcount' type='text' value='3' onchange='selectionChanged()'/>
            <p>
            Agent VM size: <select id='selector' onchange='selectionChanged()'>
            ${options}
            </select>
            </p>

            <p>
            <a id='nextlink' href='${initialUri}' onclick='promptWait()'>Create &gt;</a>
            </p>
            </div>`;

}

function renderComplete(last: StageData) : string {
    const title = last.result.succeeded ? 'Cluster creation has started' : `Error ${last.actionDescription}`;
    const additionalDiagnostic = diagnoseCreationError(last.result);
    const message = last.result.succeeded ?
        `<p class='success'>Azure is creating the cluster, but this may take some time. You can now close this window.</p>` :
        `<p class='error'>An error occurred while creating the cluster.</p>
         ${additionalDiagnostic}
         <p><b>Details</b></p>
         <p>${last.result.error[0]}</p>`;
    return `<!-- Complete -->
            <h1>${title}</h1>
            ${styles()}
            ${message}`;
}

function diagnoseCreationError(e: Errorable<any>) : string {
    if (e.succeeded) {
        return '';
    }
    if (e.error[0].indexOf('unrecognized arguments') >= 0) {
        return '<p>You may be using an older version of the Azure CLI. Check Azure CLI version is 2.0.23 or above.<p>';
    }
    return '';
}

function renderInternalError(last: StageData) : string {
    return internalError(last.result.error[0]);
}

function renderExternalError(last: StageData) : string {
    return `
    <h1>Error ${last.actionDescription}</h1>
    ${styles()}
    <p class='error'>An error occurred while ${last.actionDescription}.</p>
    <p><b>Details</b></p>
    <p>${last.result.error}</p>`;
}

// TODO: consider consolidating notifyCliError, notifyNoOptions, internalError() and styles() with acs
// (note text of notifyCliError is slightly different though)
function notifyCliError(stageId: string, last: StageData) : string {
    return `<!-- ${stageId} -->
        <h1>Error ${last.actionDescription}</h1>
        <p><span class='error'>The Azure command line failed.</span>  See below for the error message.  You may need to:</p>
        <ul>
        <li>Log into the Azure CLI (run az login in the terminal)</li>
        <li>Install the Azure CLI <a href='https://docs.microsoft.com/cli/azure/install-azure-cli'>(see the instructions for your operating system)</a></li>
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

const commandName = 'vsKubernetesCreateCluster';

function advanceUri(operationId: string, requestData: string) : string {
    return wizardAdvanceUri(commandName, operationId, requestData);
}

function selectionChangedScript(operationId: string) : string {
    return wizardSelectionChangedScript(commandName, operationId);
}

function selectionChangedScriptMulti(operationId: string, mappings: ControlMapping[]) : string {
    return wizardSelectionChangedScriptMulti(commandName, operationId, mappings);
}

