import * as clusterproviderregistry from '../clusterproviderregistry';
import { styles, formStyles, waitScript, ActionResult, Diagnostic, fromShellExitCodeOnly } from '../../../wizard';
import { propagationFields, formPage } from '../common/form';
import { refreshExplorer } from '../common/explorer';
import { succeeded, Failed, failed } from '../../../errorable';
import { Shell } from '../../../shell';
import { Minikube, MinikubeOptions } from './minikube';
import { Wizard, NEXT_FN } from '../../wizard/wizard';
import { Sequence, Observable, Observer } from '../../../utils/observable';
import { sleep } from '../../../sleep';
import { trackReadiness } from '../readinesstracker';

export interface Context {
    readonly shell: Shell;
    readonly minikube: Minikube;
}

let registered = false;

export async function init(registry: clusterproviderregistry.ClusterProviderRegistry, context: Context): Promise<void> {
    if (!registered) {
        registry.register({id: 'minikube', displayName: "Minikube local cluster", supportedActions: ['create', 'configure'], next: (w, a, m) => next(context, w, a, m)});
        registered = true;
    }
}

function next(context: Context, wizard: Wizard, action: clusterproviderregistry.ClusterProviderAction, message: any): void {
    const nextStep: string | undefined = message.nextStep;
    const requestData = nextStep ? message : { clusterType: message["clusterType"] };
    if (action === 'create') {
        wizard.showPage(getHandleCreateHtml(nextStep, context, requestData));
    } else {
        wizard.showPage(getHandleConfigureHtml(nextStep, requestData));
    }
}

function getHandleCreateHtml(step: string | undefined, context: Context, requestData: any): Sequence<string> {
    if (!step) {
        return promptForConfiguration(requestData, context, "create", "create");
    } else if (step === "create") {
        return createCluster(requestData, context);
    } else if (step === "wait") {
        return waitForClusterAndReportConfigResult(requestData, context);
    } else {
        return renderInternalError(`MinikubeStepError (${step})`);
    }
}

function getHandleConfigureHtml(step: string | undefined, requestData: any): Sequence<string> {
    if (!step || step === "configure") {
        return configureKubernetes(requestData);
    } else {
        return renderInternalError(`MinikubeStepError (${step})`);
    }
}

async function promptForConfiguration(previousData: any, context: Context, action: clusterproviderregistry.ClusterProviderAction, nextStep: string): Promise<string> {
    return formPage({
        stepId: 'PromptForConfiguration',
        title: 'Configure Minikube',
        waitText: 'Configuring Minikube',
        action: action,
        nextStep: nextStep,
        submitText: 'Start Minikube',
        previousData: previousData,
        formContent: `
        <table style='width:50%'>
        <tr>
        <td>Minikube VM Driver</td>
        <td style='text-align: right'><select name='vmdriver' id='vmdriver'>
           <option selected='true'>virtualbox</option>
           <option>vmwarefusion</option>
           <option>kvm</option>
           <option>xhyve</option>
           <option>hyperv</option>
           <option>hyperkit</option>
           <option>kvm2</option>
           <option>none</option>
        </select></td>
        </tr>
        <tr>
        <td>Additional Flags:</td>
        <td style='text-align: right'><input name='additionalflags' type='text' value='' /></td>
        </tr>
        </table>
        `
    });
}

async function configureKubernetes(previousData: any): Promise<string> {
    await refreshExplorer();
    return renderConfigurationResult();
}

async function runMinikubeCommand(context: Context, cmd: string): Promise<ActionResult<Diagnostic>> {
    const sr = await context.shell.exec(cmd);

    const createCluster = await fromShellExitCodeOnly(sr);
    return {
        actionDescription: 'creating cluster',
        result: createCluster
    };
}

async function createCluster(previousData: any, context: Context): Promise<string> {
    const runnable = await context.minikube.isRunnable();
    const createResult = {
        actionDescription: 'creating cluster',
        result: runnable
    };

    context.minikube.start({
        vmDriver: previousData.vmdriver,
        additionalFlags: previousData.additionalflags
    } as MinikubeOptions);

    const title = createResult.result.succeeded ? 'Cluster creation has started' : `Error ${createResult.actionDescription}`;
    const message = succeeded(createResult.result) ?
        `<div id='content'>
         ${formStyles()}
         ${styles()}
         <form id='form'>
         <input type='hidden' name='nextStep' value='wait' />
         ${propagationFields(previousData)}
         <p class='success'>Minikube is creating the cluster, but this may take some time. You can now close this window,
         or wait for creation to complete so that we can add the new cluster to your Kubernetes configuration.</p>
         <p><button onclick=${NEXT_FN} class='link-button'>Wait and add the new cluster &gt;</button></p>
         </form>
         </div>` :
        `<p class='error'>An error occurred while creating the cluster. Is 'minikube' installed and in your PATH?</p>
         <p><b>Details</b></p>
         <p>${createResult.result.error[0]}</p>`;
    return `<!-- Complete -->
            <h1 id='h'>${title}</h1>
            ${styles()}
            ${waitScript('Waiting for cluster - this will take several minutes')}
            ${message}`;

}

function refreshCountIndicator(refreshCount: number): string {
    return ".".repeat(refreshCount % 4);
}

function waitForClusterAndReportConfigResult(previousData: any, context: Context): Observable<string> {

    async function waitOnce(refreshCount: number): Promise<[string, boolean]> {
        const waitResult = await runMinikubeCommand(context, 'minikube status');
        if (!waitResult.result.succeeded) {
            const failed = waitResult.result as Failed;
            const message = `<h1>Waiting for minikube cluster${refreshCountIndicator(refreshCount)}</h1>
            <p>Current Status</p>
            <pre><code>${failed.error[0]}</code></pre>
            <form id='form'>
            <input type='hidden' name='nextStep' value='wait' />
            ${propagationFields(previousData)}
            </form>
            `;
            return [message, true];
        }

        await refreshExplorer();

        return [renderConfigurationResult(), false];
    }

    return trackReadiness(100, waitOnce);
}

function renderConfigurationResult(): string {
    const title = 'Cluster added';
    return `<!-- Complete -->
            <h1>${title}</h1>
            ${styles()}`;
}

function renderInternalError(error: string): string {
    return `
<h1>Internal extension error</h1>
${styles()}
<p class='error'>An internal error occurred in the vscode-kubernetes-tools extension.</p>
<p>This is not an Azure or Kubernetes issue.  Please report error text '${error}' to the extension authors.</p>
`;
}
