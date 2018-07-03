import * as restify from 'restify';
import * as portfinder from 'portfinder';
import * as clusterproviderregistry from '../clusterproviderregistry';
import * as azure from './azure';
import { styles, formStyles, waitScript, ActionResult, Diagnostic } from '../../../wizard';
import { Errorable, succeeded, failed, Failed, Succeeded } from '../../../errorable';
import { formPage, propagationFields } from '../common/form';
import { refreshExplorer } from '../common/explorer';

// HTTP request dispatch

// TODO: de-globalise
let wizardServer: restify.Server;
let wizardPort: number;

type HtmlRequestHandler = (
    step: string | undefined,
    context: azure.Context,
    requestData: any,
) => Promise<string>;

export async function init(registry: clusterproviderregistry.ClusterProviderRegistry, context: azure.Context): Promise<void> {
    if (!wizardServer) {
        wizardServer = restify.createServer({
            formatters: {
                'text/html': (req, resp, body) => body
            }
        });

        wizardPort = await portfinder.getPortPromise({ port: 44000 });

        const htmlServer = new HtmlServer(context);

        wizardServer.use(restify.plugins.queryParser(), restify.plugins.bodyParser());
        wizardServer.listen(wizardPort, '127.0.0.1');

        // You MUST use fat arrow notation for the handler callbacks: passing the
        // function reference directly will foul up the 'this' pointer.
        wizardServer.get('/create', (req, resp, n) => htmlServer.handleGetCreate(req, resp, n));
        wizardServer.post('/create', (req, resp, n) => htmlServer.handlePostCreate(req, resp, n));
        wizardServer.get('/configure', (req, resp, n) => htmlServer.handleGetConfigure(req, resp, n));
        wizardServer.post('/configure', (req, resp, n) => htmlServer.handlePostConfigure(req, resp, n));

        registry.register({id: 'aks', displayName: "Azure Kubernetes Service", port: wizardPort, supportedActions: ['create', 'configure']});
        registry.register({id: 'acs', displayName: "Azure Container Service", port: wizardPort, supportedActions: ['create', 'configure']});
    }
}

class HtmlServer {
    constructor(private readonly context: azure.Context) {}

    async handleGetCreate(request: restify.Request, response: restify.Response, next: restify.Next) {
        await this.handleCreate(request, { clusterType: request.query["clusterType"] }, response, next);
    }

    async handlePostCreate(request: restify.Request, response: restify.Response, next: restify.Next) {
        await this.handleCreate(request, request.body, response, next);
    }

    async handleGetConfigure(request: restify.Request, response: restify.Response, next: restify.Next) {
        await this.handleConfigure(request, { clusterType: request.query["clusterType"] }, response, next);
    }

    async handlePostConfigure(request: restify.Request, response: restify.Response, next: restify.Next) {
        await this.handleConfigure(request, request.body, response, next);
    }

    async handleCreate(request: restify.Request, requestData: any, response: restify.Response, next: restify.Next): Promise<void> {
        await this.handleRequest(getHandleCreateHtml, request, requestData, response, next);
    }

    async handleConfigure(request: restify.Request, requestData: any, response: restify.Response, next: restify.Next): Promise<void> {
        await this.handleRequest(getHandleConfigureHtml, request, requestData, response, next);
    }

    async handleRequest(handler: HtmlRequestHandler, request: restify.Request, requestData: any, response: restify.Response, next: restify.Next) {
        const html = await handler(request.query["step"], this.context, requestData);

        response.contentType = 'text/html';
        response.send("<html><body><style id='styleholder'></style>" + html + "</body></html>");

        next();
    }
}

async function getHandleCreateHtml(step: string | undefined, context: azure.Context, requestData: any): Promise<string> {
    if (!step) {
        return await promptForSubscription(requestData, context, "create", "metadata");
    } else if (step === "metadata") {
        return await promptForMetadata(requestData, context);
    } else if (step === "agentSettings") {
        return await promptForAgentSettings(requestData, context);
    } else if (step === "create") {
        return await createCluster(requestData, context);
    } else if (step === "wait") {
        return await waitForClusterAndReportConfigResult(requestData, context);
    } else {
        return renderInternalError(`AzureStepError (${step})`);
    }
}

async function getHandleConfigureHtml(step: string | undefined, context: azure.Context, requestData: any): Promise<string> {
    if (!step) {
        return await promptForSubscription(requestData, context, "configure", "cluster");
    } else if (step === "cluster") {
        return await promptForCluster(requestData, context);
    } else if (step === "configure") {
        return await configureKubernetes(requestData, context);
    } else {
        return renderInternalError(`AzureStepError (${step})`);
    }
}

// Pages for the various wizard steps

async function promptForSubscription(previousData: any, context: azure.Context, action: clusterproviderregistry.ClusterProviderAction, nextStep: string): Promise<string> {
    const subscriptionList = await azure.getSubscriptionList(context);
    if (!subscriptionList.result.succeeded) {
        return renderCliError('PromptForSubscription', subscriptionList);
    }

    const subscriptions: string[] = subscriptionList.result.result;

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

async function promptForCluster(previousData: any, context: azure.Context): Promise<string> {
    const clusterList = await azure.getClusterList(context, previousData.subscription, previousData.clusterType);

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
        submitText: 'Add this cluster',
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

async function configureKubernetes(previousData: any, context: azure.Context): Promise<string> {
    const selectedCluster = parseCluster(previousData.cluster);
    const configureResult = await azure.configureCluster(context, previousData.clusterType, selectedCluster.name, selectedCluster.resourceGroup);
    await refreshExplorer();
    return renderConfigurationResult(configureResult);
}

async function promptForMetadata(previousData: any, context: azure.Context): Promise<string> {
    const serviceLocations = previousData.clusterType === 'acs' ?
        await azure.listAcsLocations(context) :
        await azure.listAksLocations(context);

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

async function promptForAgentSettings(previousData: any, context: azure.Context): Promise<string> {
    const vmSizes = await azure.listVMSizes(context, previousData.location);
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

async function createCluster(previousData: any, context: azure.Context): Promise<string> {

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
    const createResult = await azure.createCluster(context, options);

    const title = createResult.result.succeeded ? 'Cluster creation has started' : `Error ${createResult.actionDescription}`;
    const additionalDiagnostic = diagnoseCreationError(createResult.result);
    const successCliErrorInfo = diagnoseCreationSuccess(createResult.result);
    const message = succeeded(createResult.result) ?
        `<div id='content'>
         ${formStyles()}
         ${styles()}
         ${waitScript('Contacting Microsoft Azure')}
         <form id='form' action='create?step=wait' method='post' onsubmit='return promptWait();'>
         ${propagationFields(previousData)}
         <p class='success'>Azure is creating the cluster, but this may take some time. You can now close this window,
         or wait for creation to complete so that we can add the new cluster to your Kubernetes configuration.</p>
         <p><button type='submit' class='link-button'>Wait and add the new cluster &gt;</button></p>
         </form>
         ${successCliErrorInfo}
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

function refreshCountIndicator(): string {
    return ".".repeat(refreshCount % 4);
}

async function waitForClusterAndReportConfigResult(previousData: any, context: azure.Context): Promise<string> {

    ++refreshCount;

    const waitResult = await azure.waitForCluster(context, previousData.clusterType, previousData.clustername, previousData.resourcegroupname);
    if (failed(waitResult)) {
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

    await refreshExplorer();

    return renderConfigurationResult(configureResult);
}

function renderConfigurationResult(configureResult: ActionResult<azure.ConfigureResult>): string {
    const title = configureResult.result.succeeded ? 'Cluster added' : `Error ${configureResult.actionDescription}`;

    const result = configureResult.result as Succeeded<azure.ConfigureResult>;  // currently always reports success and puts failure in the body
    const configResult = result.result;
    const clusterServiceString = result.result.clusterType === "aks" ? "Azure Kubernetes Service" : "Azure Container Service";

    const pathMessage = configResult.cliOnDefaultPath ? '' :
        '<p>This location is not on your system PATH. Add this directory to your path, or set the VS Code <b>vs-kubernetes.kubectl-path</b> config setting.</p>';
    const getCliOutput = configResult.gotCli ?
        `<p class='success'>kubectl installed at ${configResult.cliInstallFile}</p>${pathMessage}` :
        `<p class='error'>An error occurred while downloading kubectl.</p>
         <p><b>Details</b></p>
         <p>${configResult.cliError}</p>`;
    const getCredsOutput = configResult.gotCredentials ?
        `<p class='success'>Successfully configured kubectl with ${clusterServiceString} cluster credentials.</p>` :
        `<p class='error'>An error occurred while getting ${clusterServiceString} cluster credentials.</p>
         <p><b>Details</b></p>
         <p>${configResult.credentialsError}</p>`;
    return `<!-- Complete -->
            <h1>${title}</h1>
            ${styles()}
            ${getCliOutput}
            ${getCredsOutput}`;
}

// Error rendering helpers

function diagnoseCreationError(e: Errorable<Diagnostic>): string {
    if (succeeded(e)) {
        return '';
    }
    if (e.error[0].indexOf('unrecognized arguments') >= 0) {
        return '<p>You may be using an older version of the Azure CLI. Check Azure CLI version is 2.0.23 or above.<p>';
    }
    return '';
}

function diagnoseCreationSuccess(e: Errorable<Diagnostic>): string {
    if (failed(e) || !e.result || !e.result.value) {
        return '';
    }
    const error = e.result.value;
    // Discard things printed to stderr that are known spew
    if (/Finished service principal(.+)100[.0-9%]*/.test(error)) {
        return '';
    }
    // CLI claimed it succeeded but left something on stderr, so warn the user
    return `<p><b>Note:<b> although Azure accepted the creation request, the Azure CLI reported the following message. This may indicate a problem, or may be ignorable progress messages:<p>
        <p>${error}</p>`;
}

function renderCliError<T>(stageId: string, last: ActionResult<T>): string {
    const errorInfo = last.result as Failed;
    return `<!-- ${stageId} -->
        <h1>Error ${last.actionDescription}</h1>
        <p><span class='error'>The Azure command line failed.</span>  See below for the error message.  You may need to:</p>
        <ul>
        <li>Log into the Azure CLI (run az login in the terminal)</li>
        <li>Install the Azure CLI <a href='https://docs.microsoft.com/cli/azure/install-azure-cli'>(see the instructions for your operating system)</a></li>
        <li>Configure Kubernetes from the command line using the az acs or az aks command</li>
        </ul>
        <p><b>Details</b></p>
        <p>${errorInfo.error}</p>`;
}

function renderNoOptions(stageId: string, title: string, message: string): string {
    return `
<h1>${title}</h1>
${styles()}
<p class='error'>${message}</p>
`;
}

function renderInternalError(error: string): string {
    return `
<h1>Internal extension error</h1>
${styles()}
<p class='error'>An internal error occurred in the vscode-kubernetes-tools extension.</p>
<p>This is not an Azure or Kubernetes issue.  Please report error text '${error}' to the extension authors.</p>
`;
}

// Utility helpers

function formatCluster(cluster: any): string {
    return cluster.resourceGroup + '/' + cluster.name;
}

function parseCluster(encoded: string): azure.ClusterInfo {
    const delimiterPos = encoded.indexOf('/');
    return {
        resourceGroup: encoded.substr(0, delimiterPos),
        name: encoded.substr(delimiterPos + 1)
    };
}
