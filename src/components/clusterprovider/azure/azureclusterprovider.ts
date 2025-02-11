import * as vscode from 'vscode';
import { Failed, Succeeded } from '../../../errorable';
import { reporter } from '../../../telemetry';
import { Sequence } from '../../../utils/observable';
import { ActionResult, styles } from '../../../wizard';
import { Wizard } from '../../wizard/wizard';
import * as clusterproviderregistry from '../clusterproviderregistry';
import { refreshExplorer } from '../common/explorer';
import { formPage } from '../common/form';
import * as azure from './azure';

// TODO: de-globalise
let registered = false;

export async function init(registry: clusterproviderregistry.ClusterProviderRegistry, context: azure.Context): Promise<void> {
    if (!registered) {
        registry.register({ id: 'aks', displayName: "Azure Kubernetes Service", supportedActions: ['create', 'configure'], next: (w, a, m) => next(context, w, a, m) });
        registered = true;
    }
}

// Wizard step dispatch

function next(context: azure.Context, wizard: Wizard, action: clusterproviderregistry.ClusterProviderAction, message: any): void {
    wizard.showPage("<h1>Contacting Microsoft Azure</h1>");
    const nextStep: string | undefined = message.nextStep;
    const requestData = nextStep ? message : { clusterType: message["clusterType"] };
    if (action === 'create') {
        wizard.showPage(getHandleCreateHtml(nextStep, context, requestData));
    } else {
        wizard.showPage(getHandleConfigureHtml(nextStep, context, requestData));
    }
}

function getHandleCreateHtml(step: string | undefined, context: azure.Context, requestData: any): Sequence<string> {
    if (!step) {
        return promptForSubscription(requestData, context, "create", "create");
    } else if (step === "create") {
        return createClusterViaAKSExtension(requestData);
    } else {
        return renderInternalError(`AzureStepError (${step})`);
    }
}

function getHandleConfigureHtml(step: string | undefined, context: azure.Context, requestData: any): Sequence<string> {
    if (!step) {
        return promptForSubscription(requestData, context, "configure", "cluster");
    } else if (step === "cluster") {
        return promptForCluster(requestData, context);
    } else if (step === "configure") {
        return configureKubernetes(requestData, context);
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

    const subscriptions: azure.Subscription[] = subscriptionList.result.result;

    if (!subscriptions || !subscriptions.length) {
        return renderNoOptions('No Azure subscriptions', 'You have no Azure subscriptions.');
    }

    // sort by name
    subscriptions.sort((a, b) => a.name.localeCompare(b.name));

    const options = subscriptions.map((s) => `<option value="${s.id}">${s.name}</option>`).join('\n');
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
    const clusterList = await azure.getClusterList(context, previousData.subscription);

    if (!clusterList.result.succeeded) {
        return renderCliError('PromptForCluster', clusterList);
    }

    const clusters = clusterList.result.result;

    if (!clusters || clusters.length === 0) {
        return renderNoOptions('No clusters', 'There are no Kubernetes clusters in the selected subscription.');
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

async function createClusterViaAKSExtension(previousData: any) {
    // invoke aks extension command
    // check if aks extension is installed
    const aksExtension =  vscode.extensions.getExtension("ms-kubernetes-tools.vscode-aks-tools");
    if (!aksExtension) {
        // install aks extension
        await vscode.commands.executeCommand("extension.open", "ms-kubernetes-tools.vscode-aks-tools");
    }
    // invoke aks extension command
    vscode.commands.executeCommand("aks.createCluster", previousData.subscription);
    return "<h1>Creating cluster using Azure Kubernetes Service extension</h1>";
}

function renderConfigurationResult(configureResult: ActionResult<azure.ConfigureResult>): string {
    const title = configureResult.result.succeeded ? 'Cluster added' : `Error ${configureResult.actionDescription}`;

    const result = configureResult.result as Succeeded<azure.ConfigureResult>;  // currently always reports success and puts failure in the body
    const configResult = result.result;
    const clusterServiceString = result.result.clusterType === "aks" ? "Azure Kubernetes Service" : "Azure Container Service";

    if (reporter) {
        reporter.sendTelemetryEvent("clusterregistration", { result: (configResult.gotCli && configResult.gotCredentials) ? "success" : "failure", clusterType: configResult.clusterType });
    }

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

function renderCliError<T>(stageId: string, last: ActionResult<T>): string {
    const errorInfo = last.result as Failed;
    return `<!-- ${stageId} -->
        <h1>Error ${last.actionDescription}</h1>
        <p><span class='error'>The Azure command line failed.</span>  See below for the error message.  You may need to:</p>
        <ul>
        <li>Log into the Azure CLI (run az login in the terminal)</li>
        <li>Install the Azure CLI <a href='https://docs.microsoft.com/cli/azure/install-azure-cli'>(see the instructions for your operating system)</a></li>
        <li>Configure Kubernetes from the command line using the az aks command</li>
        </ul>
        <p><b>Details</b></p>
        <p>${errorInfo.error}</p>`;
}

function renderNoOptions(title: string, message: string): string {
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
    return `${cluster.resourceGroup}/${cluster.name}`;
}

function parseCluster(encoded: string): azure.ClusterInfo {
    const delimiterPos = encoded.indexOf('/');
    return {
        resourceGroup: encoded.substr(0, delimiterPos),
        name: encoded.substr(delimiterPos + 1)
    };
}
