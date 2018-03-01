import * as restify from 'restify';
import * as clusterproviderregistry from '../clusterproviderregistry';
import * as azure from '../../../azure';
import { Errorable, ControlMapping, script, styles, waitScript } from '../../../wizard';
import { agent } from 'spdy';

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
    
        registry.register({id: 'acs', displayName: "Azure Container Service", port: clusterPort});
        registry.register({id: 'aks', displayName: "Azure Kubernetes Service", port: clusterPort});

        context = ctx;
    }
}

async function handleGetCreate(request: restify.Request, response: restify.Response, next: restify.Next) {
    await handleCreate(request, { clusterType: request.query["clusterType"] }, response, next);
}

async function handlePostCreate(request: restify.Request, response: restify.Response, next: restify.Next) {
    await handleCreate(request, request.body, response, next);
}

async function handleCreate(request: restify.Request, requestData: any, response: restify.Response, next: restify.Next) {
    const html = await getHandleCreateHtml(request.query["step"], requestData);

    response.contentType = 'text/html';
    response.send("<html><body><style id='styleholder'></style>" + html + "</body></html>");
    
    next();
}

async function getHandleCreateHtml(step: string | undefined, requestData: any | undefined): Promise<string> {
    if (!step) {
        return await promptForSubscription(requestData);
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

async function promptForSubscription(previousData: any) : Promise<string> {
    const slr = await azure.getSubscriptionList(context, previousData.id);
    if (!slr.result.succeeded) {
        return `<h1>Error ${slr.actionDescription}</h1><p>Error details: ${slr.result.error[0]}</p>`;
    }

    const subscriptions : string[] = slr.result.result;

    if (!subscriptions || !subscriptions.length) {
        return `<h1>You have no Azure subscriptions</h1>`;
    }


    const options = subscriptions.map((s) => `<option value="${s}">${s}</option>`).join('\n');
    return `<!-- PromptForSubscription -->
            <h1 id='h'>Choose subscription</h1>
            ${formStyles()}
            <div id='content'>
            <form id='form' action='create?step=metadata' method='post'>
            ${propagationFields(previousData)}
            <p>
            Azure subscription: <select name='subscription' id='selector'>
            ${options}
            </select>
            </p>

            <p><b>Important! The selected subscription will be set as the active subscription for the Azure CLI.</b></p>

            <p>
            <button type='submit' class='link-button'>Next &gt;</button>
            </p>
            </form>
            </div>`;
}

async function promptForMetadata(previousData: any) : Promise<string> {
    const serviceLocations = previousData.clusterType === 'acs' ?
        await listAcsLocations(context) :
        await listAksLocations(context);

    if (!serviceLocations.succeeded) {
        return "<h1>Error getting locations</h1>";
    }

    const options = serviceLocations.result.map((s) => `<option value="${s.displayName}">${s.displayName + (s.isPreview ? " (preview)" : "")}</option>`).join('\n');

    return `<!-- PromptForMetadata -->
            <h1 id='h'>Azure cluster settings</h1>
            ${formStyles()}
            <div id='content'>
            <form id='form' action='create?step=agentSettings' method='post'>
            ${propagationFields(previousData)}
            <p>Cluster name: <input name='clustername' type='text' value='k8scluster' />
            <p>Resource group name: <input name='resourcegroupname' type='text' value='k8scluster' />
            <p>
            Location: <select name='location'>
            ${options}
            </select>
            </p>

            <p>
            <button type='submit' class='link-button'>Next &gt;</button>
            </p>
            </form>
            </div>`;
}

async function promptForAgentSettings(previousData: any) : Promise<string> {
    const vmSizes = await listVMSizes(context, previousData.location);
    if (!vmSizes.succeeded) {
        return `<h1>Error getting VM sizes</h1><p>Error detail: ${vmSizes.error[0]}</p>`;
    }

    const defaultSize = "Standard_D2_v2";
    const options = vmSizes.result.map((s) => `<option value="${s}" ${s == defaultSize ? "selected=true" : ""}>${s}</option>`).join('\n');

    return `<!-- PromptForAgentSettings -->
            <h1 id='h'>Azure agent settings</h1>
            ${formStyles()}
            <div id='content'>
            <form id='form' action='create?step=create' method='post'>
            ${propagationFields(previousData)}
            <p>Agent count: <input name='agentcount' type='text' value='3'/>
            <p>
            Agent VM size: <select name='agentvmsize'>
            ${options}
            </select>
            </p>

            <p>
            <button type='submit' class='link-button'>Create cluster &gt;</button>
            </p>
            </form>
            </div>`;
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
         <form id='form' action='create?step=wait' method='post'>
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

function refreshorama() : string {
    return ".".repeat(refreshCount % 4);
}

async function waitForClusterAndReportConfigResult(previousData: any) : Promise<string> {

    ++refreshCount;

    const waitResult = await waitForCluster(context, previousData.clusterType, previousData.clustername, previousData.resourcegroupname);
    if (!waitResult.succeeded) {
        return `<h1>Error creating cluster</h1><p>Error details: ${waitResult.error[0]}</p>`;
    }

    if (waitResult.result.stillWaiting) {
        return `<h1>Waiting for cluster - this will take several minutes${refreshorama()}</h1>
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

async function createClusterImpl(context: azure.Context, options: any) : Promise<{actionDescription: string, result: Errorable<void>}> {
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
