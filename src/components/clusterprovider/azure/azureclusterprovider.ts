import * as restify from 'restify';
import * as clusterproviderregistry from '../clusterproviderregistry';
import * as azure from '../../../azure';
import { Errorable, script, styles, waitScript, ActionResult } from '../../../wizard';
import { agent } from 'spdy';
import { request } from 'https';

interface ClusterInfo {
    readonly name: string;
    readonly resourceGroup: string;
}

// TODO: de-globalise
let clusterServer : restify.Server;
const clusterPort = 44011;
let context : azure.Context;

export function init(registry: clusterproviderregistry.ClusterProviderRegistry, ctx: azure.Context) {
    if (!clusterServer) {
        clusterServer = restify.createServer({
            formatters: {
                'text/html': (req, resp, body) => body
            }
        });
        
        clusterServer.use(restify.plugins.queryParser(), restify.plugins.bodyParser());
        clusterServer.listen(clusterPort);
        clusterServer.get('/create', handleGetCreate);
        clusterServer.post('/create', handlePostCreate);
        clusterServer.get('/configure', handleGetConfigure);
        clusterServer.post('/configure', handlePostConfigure);
    
        registry.register({id: 'acs', displayName: "Azure Container Service", port: clusterPort, supportedActions: ['create','configure']});
        registry.register({id: 'aks', displayName: "Azure Kubernetes Service", port: clusterPort, supportedActions: ['create','configure']});

        context = ctx;
    }
}

async function handleGetCreate(request: restify.Request, response: restify.Response, next: restify.Next) {
    await handleCreate(request, { clusterType: request.query["clusterType"] }, response, next);
}

async function handlePostCreate(request: restify.Request, response: restify.Response, next: restify.Next) {
    await handleCreate(request, request.body, response, next);
}

async function handleGetConfigure(request: restify.Request, response: restify.Response, next: restify.Next) {
    await handleConfigure(request, { clusterType: request.query["clusterType"] }, response, next);
}

async function handlePostConfigure(request: restify.Request, response: restify.Response, next: restify.Next) {
    await handleConfigure(request, request.body, response, next);
}

async function handleCreate(request: restify.Request, requestData: any, response: restify.Response, next: restify.Next) {
    const html = await getHandleCreateHtml(request.query["step"], requestData);

    response.contentType = 'text/html';
    response.send("<html><body><style id='styleholder'></style>" + html + "</body></html>");
    
    next();
}

// TODO: oh the duplication
async function handleConfigure(request: restify.Request, requestData: any, response: restify.Response, next: restify.Next) {
    const html = await getHandleConfigureHtml(request.query["step"], requestData);

    response.contentType = 'text/html';
    response.send("<html><body><style id='styleholder'></style>" + html + "</body></html>");
    
    next();
}

async function getHandleCreateHtml(step: string | undefined, requestData: any | undefined): Promise<string> {
    if (!step) {
        return await promptForSubscription(requestData, "create", "metadata");
    } else if (step === "metadata") {
        return await promptForMetadata(requestData);
    } else if (step === "agentSettings") {
        return await promptForAgentSettings(requestData);
    } else if (step === "create") {
        return await createCluster(requestData);
    } else if (step === "wait") {
        return await waitForClusterAndReportConfigResult(requestData);
    }
}

async function getHandleConfigureHtml(step: string | undefined, requestData: any | undefined): Promise<string> {
    if (!step) {
        return await promptForSubscription(requestData, "configure", "cluster");
    } else if (step === "cluster") {
        return await promptForCluster(requestData);
    } else if (step === "configure") {
        return await configureKubernetes(requestData);
    }
}

function formStyles() : string {
    return `
    <style>
    .link-button {
        background: none;
        border: none;
        color: blue;
        text-decoration: underline;
        cursor: pointer;
        font-size: 1em;
        font-family: sans-serif;
    }
    .vscode-light .link-button {
        color: navy;
    }
    .vscode-dark .link-button {
        color: azure;
    }
    .link-button:focus {
        outline: none;
    }
    .link-button:active {
        color:red;
    }
    </style>`;
}

function propagationFields(previousData: any) : string {
    let formFields = "";
    for (const k in previousData) {
        formFields = formFields + `<input type='hidden' name='${k}' value='${previousData[k]}' />\n`;
    }
    return formFields;
}

interface FormData {
    stepId: string;
    title: string;
    waitText: string;
    action: string;
    nextStep: string;
    submitText: string;
    previousData: any;
    formContent: string;
}

function formPage(fd: FormData) : string {
    return `<!-- ${fd.stepId} -->
            <h1 id='h'>${fd.title}</h1>
            ${formStyles()}
            ${styles()}
            ${waitScript(fd.waitText)}
            <div id='content'>
            <form id='form' action='${fd.action}?step=${fd.nextStep}' method='post' onsubmit='return promptWait();'>
            ${propagationFields(fd.previousData)}
            ${fd.formContent}
            <p>
            <button type='submit' class='link-button'>${fd.submitText} &gt;</button>
            </p>
            </form>
            </div>`;
}

async function promptForSubscription(previousData: any, action: clusterproviderregistry.ClusterProviderAction, nextStep: string) : Promise<string> {
    const subscriptionList = await azure.getSubscriptionList(context, previousData.id);
    if (!subscriptionList.result.succeeded) {
        return renderCliError('PromptForSubscription', subscriptionList);
    }

    const subscriptions : string[] = subscriptionList.result.result;

    if (!subscriptions || !subscriptions.length) {
        return renderNoOptions('PromptForSubscription', 'No Azure subscriptions', 'You have no Azure subscriptions.');
    }

    const options = subscriptions.map((s) => `<option value="${s}">${s}</option>`).join('\n');
    return formPage({
        stepId: 'PromptForSubscription',
        title: 'Choose subscription',
        waitText: 'Contacting Microsoft Azure',
        action: action,
        nextStep: nextStep,
        submitText: 'Next',
        previousData: previousData,
        formContent: `
            <p>
            Azure subscription: <select name='subscription' id='selector'>
            ${options}
            </select>
            </p>

            <p><b>Important! The selected subscription will be set as the active subscription for the Azure CLI.</b></p>
        `
    });
}

async function promptForCluster(previousData: any) : Promise<string> {
    const clusterList = await getClusterList(context, previousData.subscription, previousData.clusterType);

    if (!clusterList.result.succeeded) {
        return renderCliError('PromptForCluster', clusterList);
    }

    const clusters = clusterList.result.result;

    if (!clusters || clusters.length === 0) {
        return renderNoOptions('PromptForCluster', 'No clusters', 'There are no Kubernetes clusters in the selected subscription.');
    }

    const options = clusters.map((c) => `<option value="${formatCluster(c)}">${c.name} (in ${c.resourceGroup})</option>`).join('\n');
    return formPage({
        stepId: 'PromptForCluster',
        title: 'Choose cluster',
        waitText: 'Configuring Kubernetes',
        action: 'configure',
        nextStep: 'configure',
        submitText: 'Configure',
        previousData: previousData,
        formContent: `
            <p>
            Kubernetes cluster: <select name='cluster'>
            ${options}
            </select>
            </p>
        `
    });
}

async function configureKubernetes(previousData: any) : Promise<string> {
    const selectedCluster = parseCluster(previousData.cluster);
    const configureResult = await azure.configureCluster(context, previousData.clusterType, selectedCluster.name, selectedCluster.resourceGroup);
    return renderConfigurationResult(configureResult);
}

async function promptForMetadata(previousData: any) : Promise<string> {
    const serviceLocations = previousData.clusterType === 'acs' ?
        await listAcsLocations(context) :
        await listAksLocations(context);

    if (!serviceLocations.succeeded) {
        return renderCliError('PromptForMetadata', {
            actionDescription: 'listing available regions',
            result: serviceLocations
        });
    }

    const options = serviceLocations.result.map((s) => `<option value="${s.displayName}">${s.displayName + (s.isPreview ? " (preview)" : "")}</option>`).join('\n');

    return formPage({
        stepId: 'PromptForMetadata',
        title: 'Azure cluster settings',
        waitText: 'Contacting Microsoft Azure',
        action: 'create',
        nextStep: 'agentSettings',
        submitText: 'Next',
        previousData: previousData,
        formContent: `
            <p>Cluster name: <input name='clustername' type='text' value='k8scluster' />
            <p>Resource group name: <input name='resourcegroupname' type='text' value='k8scluster' />
            <p>
            Location: <select name='location'>
            ${options}
            </select>
            </p>
        `
    });
}

async function promptForAgentSettings(previousData: any) : Promise<string> {
    const vmSizes = await listVMSizes(context, previousData.location);
    if (!vmSizes.succeeded) {
        return renderCliError('PromptForAgentSettings', {
            actionDescription: 'listing available node sizes',
            result: vmSizes
        });
    }

    const defaultSize = "Standard_D2_v2";
    const options = vmSizes.result.map((s) => `<option value="${s}" ${s == defaultSize ? "selected=true" : ""}>${s}</option>`).join('\n');

    return formPage({
        stepId: 'PromptForAgentSettings',
        title: 'Azure agent settings',
        waitText: 'Contacting Microsoft Azure',
        action: 'create',
        nextStep: 'create',
        submitText: 'Create cluster',
        previousData: previousData,
        formContent: `
            <p>Agent count: <input name='agentcount' type='text' value='3'/>
            <p>
            Agent VM size: <select name='agentvmsize'>
            ${options}
            </select>
            </p>
        `
    });
}

async function createCluster(previousData: any) : Promise<string> {

    const options = {
        clusterType: previousData.clusterType,
        subscription: previousData.subscription,
        metadata: {
            location: previousData.location,
            resourceGroupName: previousData.resourcegroupname,
            clusterName: previousData.clustername
        },
        agentSettings: {
            count: previousData.agentcount,
            vmSize: previousData.agentvmsize
            
        } };
    const createResult = await createClusterImpl(context, options);

    const title = createResult.result.succeeded ? 'Cluster creation has started' : `Error ${createResult.actionDescription}`;
    const additionalDiagnostic = diagnoseCreationError(createResult.result);
    const message = createResult.result.succeeded ?
        `<div id='content'>
         ${formStyles()}
         ${styles()}
         ${waitScript('Contacting Microsoft Azure')}
         <form id='form' action='create?step=wait' method='post' onsubmit='return promptWait();'>
         ${propagationFields(previousData)}
         <p class='success'>Azure is creating the cluster, but this may take some time. You can now close this window,
         or wait for creation to complete so that we can configure the extension to use the cluster.</p>
         <p><button type='submit' class='link-button'>Wait and configure the extension &gt;</button></p>
         </form>
         </div>` :
        `<p class='error'>An error occurred while creating the cluster.</p>
         ${additionalDiagnostic}
         <p><b>Details</b></p>
         <p>${createResult.result.error[0]}</p>`;
    return `<!-- Complete -->
            <h1 id='h'>${title}</h1>
            ${styles()}
            ${waitScript('Waiting for cluster - this will take several minutes')}
            ${message}`;

}

let refreshCount = 0;  // TODO: ugh

function refreshCountIndicator() : string {
    return ".".repeat(refreshCount % 4);
}

async function waitForClusterAndReportConfigResult(previousData: any) : Promise<string> {

    ++refreshCount;

    const waitResult = await waitForCluster(context, previousData.clusterType, previousData.clustername, previousData.resourcegroupname);
    if (!waitResult.succeeded) {
        return `<h1>Error creating cluster</h1><p>Error details: ${waitResult.error[0]}</p>`;
    }

    if (waitResult.result.stillWaiting) {
        return `<h1>Waiting for cluster - this will take several minutes${refreshCountIndicator()}</h1>
            <form id='form' action='create?step=wait' method='post'>
            ${propagationFields(previousData)}
            </form>
            <script>
            window.setTimeout(function() {
                var f = document.getElementById('form');
                f.submit();
            }, 100)
            </script>`;
    }

    const configureResult = await azure.configureCluster(context, previousData.clusterType, previousData.clustername, previousData.resourcegroupname);

    return renderConfigurationResult(configureResult);
}

function renderConfigurationResult(configureResult: ActionResult<azure.ConfigureResult>) : string {
    const title = configureResult.result.succeeded ? 'Configuration completed' : `Error ${configureResult.actionDescription}`;
    const configResult = configureResult.result.result;
    const pathMessage = configResult.cliOnDefaultPath ? '' :
        '<p>This location is not on your system PATH. Add this directory to your path, or set the VS Code <b>vs-kubernetes.kubectl-path</b> config setting.</p>';
    const getCliOutput = configResult.gotCli ?
        `<p class='success'>kubectl installed at ${configResult.cliInstallFile}</p>${pathMessage}` :
        `<p class='error'>An error occurred while downloading kubectl.</p>
         <p><b>Details</b></p>
         <p>${configResult.cliError}</p>`;
    const getCredsOutput = configResult.gotCredentials ?
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

async function getClusterList(context: azure.Context, subscription: string, clusterType: string) : Promise<ActionResult<ClusterInfo[]>> {
    // log in
    const login = await azure.setSubscriptionAsync(context, subscription);
    if (!login.succeeded) {
        return {
            actionDescription: 'logging into subscription',
            result: { succeeded: false, result: [], error: login.error }
        };
    }

    // list clusters
    const clusters = await listClustersAsync(context, clusterType);
    return {
        actionDescription: 'listing clusters',
        result: clusters
    };
}

async function listClustersAsync(context: azure.Context, clusterType: string) : Promise<Errorable<ClusterInfo[]>> {
    let cmd = getListClustersCommand(context, clusterType);
    const sr = await context.shell.exec(cmd);

    if (sr.code === 0 && !sr.stderr) {
        const clusters : ClusterInfo[] = JSON.parse(sr.stdout);
        return { succeeded: true, result: clusters, error: [] };
    } else {
        return { succeeded: false, result: [], error: [sr.stderr] };
    }
}

function listClustersFilter(clusterType: string): string {
    if (clusterType == 'acs') {
        return '?orchestratorProfile.orchestratorType==`Kubernetes`';
    }
    return '';
}

function getListClustersCommand(context: azure.Context, clusterType: string) : string {
    let filter = listClustersFilter(clusterType);
    let query = `[${filter}].{name:name,resourceGroup:resourceGroup}`;
    if (context.shell.isUnix()) {
        query = `'${query}'`;
    }
    return `az ${azure.getClusterCommand(clusterType)} list --query ${query} -ojson`;
}

function formatCluster(cluster: any) : string {
    return cluster.resourceGroup + '/' + cluster.name;
}

function parseCluster(encoded: string) : ClusterInfo {
    const delimiterPos = encoded.indexOf('/');
    return {
        resourceGroup: encoded.substr(0, delimiterPos),
        name: encoded.substr(delimiterPos + 1)
    };
}

async function listLocations(context: azure.Context) : Promise<Errorable<azure.Locations>> {
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

async function listAcsLocations(context: azure.Context) : Promise<Errorable<azure.ServiceLocation[]>> {
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

async function listAksLocations(context: azure.Context) : Promise<Errorable<azure.ServiceLocation[]>> {
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

function locationDisplayNames(names: string[], preview: boolean, locationInfo: azure.Locations) : azure.ServiceLocation[] {
    return names.map((n) => { return { displayName: locationInfo.locations[n], isPreview: preview }; });
}

function locationDisplayNamesEx(production: string[], preview: string[], locationInfo: azure.Locations) : azure.ServiceLocation[] {
    let result = locationDisplayNames(production, false, locationInfo) ;
    result = result.concat(locationDisplayNames(preview, true, locationInfo));
    return result;
}

async function listVMSizes(context: azure.Context, location: string) : Promise<Errorable<string[]>> {
    const sr = await context.shell.exec(`az vm list-sizes -l "${location}" -ojson`);
    
    if (sr.code === 0 && !sr.stderr) {
        const response : any[] = JSON.parse(sr.stdout);
        const result = response.map((r) => r.name as string);
        return { succeeded: true, result: result, error: [] };
    } else {
        return { succeeded: false, result: [], error: [sr.stderr] };
    }
}

async function resourceGroupExists(context: azure.Context, resourceGroupName: string) : Promise<boolean> {
    const sr = await context.shell.exec(`az group show -n "${resourceGroupName}" -ojson`);
    
    if (sr.code === 0 && !sr.stderr) {
        return sr.stdout !== null && sr.stdout.length > 0;
    } else {
        return false;
    }
}

async function ensureResourceGroupAsync(context: azure.Context, resourceGroupName: string, location: string) : Promise<Errorable<void>> {
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

async function execCreateClusterCmd(context: azure.Context, options: any) : Promise<Errorable<void>> {
    const clusterCmd = azure.getClusterCommand(options.clusterType);
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

async function createClusterImpl(context: azure.Context, options: any) : Promise<ActionResult<void>> {
    const description = `
    Created ${options.clusterType} cluster ${options.metadata.clusterName} in ${options.metadata.resourceGroupName} with ${options.agentSettings.count} agents.
    `;

    const login = await azure.setSubscriptionAsync(context, options.subscription);
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

interface WaitResult {
    readonly stillWaiting?: boolean;
}

async function waitForCluster(context: azure.Context, clusterType: string, clusterName: string, clusterResourceGroup: string): Promise<Errorable<WaitResult>> {
    const clusterCmd = azure.getClusterCommand(clusterType);
    const waitCmd = `az ${clusterCmd} wait --created --timeout 15 -n ${clusterName} -g ${clusterResourceGroup} -o json`;
    const sr = await context.shell.exec(waitCmd);

    if (sr.code === 0) {
        return { succeeded: true, result: { stillWaiting: sr.stdout !== "" }, error: [] };
    } else {
        return { succeeded: false, result: { }, error: [sr.stderr] };
    }
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

function renderCliError<T>(stageId: string, last: ActionResult<T>) : string {
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

function renderNoOptions(stageId: string, title: string, message: string) : string {
    return `
<h1>${title}</h1>
${styles()}
<p class='error'>${message}</p>
`;
}

function renderInternalError(error: string) : string {
    return `
<h1>Internal extension error</h1>
${styles()}
<p class='error'>An internal error occurred in the vscode-kubernetes-tools extension.</p>
<p>This is not an Azure or Kubernetes issue.  Please report error text '${error}' to the extension authors.</p>
`;
}

function renderExternalError<T>(last: ActionResult<T>) : string {
    return `
    <h1>Error ${last.actionDescription}</h1>
    ${styles()}
    <p class='error'>An error occurred while ${last.actionDescription}.</p>
    <p><b>Details</b></p>
    <p>${last.result.error}</p>`;
}
