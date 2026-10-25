import * as clusterproviderregistry from '../clusterproviderregistry';
import { styles, formStyles, waitScript, ActionResult, Diagnostic, fromShellExitCodeOnly } from '../../../wizard';
import { propagationFields, formPage } from '../common/form';
import { refreshExplorer } from '../common/explorer';
import { succeeded, Failed } from '../../../errorable';
import { Minikube } from './minikube';
import { minikubeLifecycleArgs, minikubeStartCommand, MINIKUBE_VM_DRIVERS } from './commands';
import { Wizard, NEXT_FN } from '../../wizard/wizard';
import { Sequence, Observable } from '../../../utils/observable';
import { trackReadiness } from '../readinesstracker';
import { escape as htmlEscape } from 'lodash';
import { getUseWsl } from '../../config/config';

export interface Context {
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
        return promptForConfiguration(requestData, "create", "create");
    } else if (step === "create") {
        return createCluster(requestData, context);
    } else if (step === "wait") {
        return waitForClusterAndReportConfigResult(requestData, context);
    } else {
        return renderInternalError(`MinikubeStepError (${step})`);
    }
}

function getHandleConfigureHtml(step: string | undefined, _requestData: any): Sequence<string> {
    if (!step || step === "configure") {
        return configureKubernetes();
    } else {
        return renderInternalError(`MinikubeStepError (${step})`);
    }
}

async function promptForConfiguration(previousData: any, action: clusterproviderregistry.ClusterProviderAction, nextStep: string): Promise<string> {
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
           ${MINIKUBE_VM_DRIVERS.map((driver, index) => `<option${index === 0 ? " selected='true'" : ''}>${driver}</option>`).join('')}
        </select></td>
        </tr>
        <tr>
        <td>Minikube Profile:</td>
        <td style='text-align: right'><input name='profile' type='text' value='' placeholder='minikube' /></td>
        </tr>
        <tr>
        <td>Additional Flags:</td>
        <td style='text-align: right'><input name='additionalflags' type='text' value='' /></td>
        </tr>
        </table>
        `
    });
}

async function configureKubernetes(): Promise<string> {
    await refreshExplorer();
    return renderConfigurationResult();
}

async function runMinikubeCommand(context: Context, args: readonly string[]): Promise<ActionResult<Diagnostic>> {
    const sr = await context.minikube.invokeCommand(args);

    const createCluster = await fromShellExitCodeOnly(sr, "Unable to run Minikube");
    return {
        actionDescription: 'creating cluster',
        result: createCluster
    };
}

export async function createCluster(previousData: any, context: Context): Promise<string> {
    const options = {
        vmDriver: previousData.vmdriver,
        additionalFlags: previousData.additionalflags,
        profile: previousData.profile,
    };
    const command = minikubeStartCommand(options);
    const runnable = command.succeeded ? await context.minikube.isRunnable() : command;
    let started = false;
    let startUseWsl: boolean | undefined;
    if (runnable.succeeded) {
        try {
            startUseWsl = !!getUseWsl();
            started = await context.minikube.start(options);
        } catch (_err) {
            started = false;
        }
    }
    const result = started ? runnable : runnable.succeeded ?
        { succeeded: false as const, error: ['Unable to start Minikube.'] } :
        runnable;
    const createResult = {
        actionDescription: 'creating cluster',
        result,
    };

    const title = createResult.result.succeeded ? 'Cluster creation has started' : `Error ${createResult.actionDescription}`;
    const message = succeeded(createResult.result) ?
        `<div id='content'>
         ${formStyles()}
         ${styles()}
         <form id='form'>
         <input type='hidden' name='nextStep' value='wait' />
         ${propagationFields({ ...previousData, minikubeusewsl: startUseWsl })}
         <p class='success'>Minikube is creating the cluster, but this may take some time. You can now close this window,
         or wait for creation to complete so that we can add the new cluster to your Kubernetes configuration.</p>
         <p><button onclick=${NEXT_FN} class='link-button'>Wait and add the new cluster &gt;</button></p>
         </form>
         </div>` :
        `<p class='error'>An error occurred while creating the cluster. Is 'minikube' installed and in your PATH?</p>
         <p><b>Details</b></p>
         <p>${htmlEscape(createResult.result.error[0])}</p>`;
    return `<!-- Complete -->
            <h1 id='h'>${title}</h1>
            ${styles()}
            ${waitScript('Waiting for cluster - this will take several minutes')}
            ${message}`;

}

function refreshCountIndicator(refreshCount: number): string {
    return ".".repeat(refreshCount % 4);
}

export function waitForClusterAndReportConfigResult(previousData: any, context: Context): Observable<string> {
    return trackReadiness(100, (refreshCount) => waitForClusterOnce(previousData, context, refreshCount));
}

export async function waitForClusterOnce(previousData: any, context: Context, refreshCount: number): Promise<[string, boolean]> {
    if (minikubeModeChanged(previousData)) {
        return [`<h1>Error waiting for minikube cluster</h1>
        <p>The Minikube execution mode changed after the cluster start was requested.</p>`, false];
    }
    const command = minikubeStartCommand({
        vmDriver: previousData.vmdriver,
        additionalFlags: previousData.additionalflags,
        profile: previousData.profile,
    });
    if (!command.succeeded) {
        return [`<h1>Error waiting for minikube cluster</h1>
        <p>${htmlEscape(command.error[0])}</p>`, false];
    }
    const waitResult = await runMinikubeCommand(context, minikubeLifecycleArgs('status', command.result.profile));
    if (minikubeModeChanged(previousData)) {
        return [`<h1>Error waiting for minikube cluster</h1>
        <p>The Minikube execution mode changed after the cluster start was requested.</p>`, false];
    }
    if (!waitResult.result.succeeded) {
        const failed = waitResult.result as Failed;
        const message = `<h1>Waiting for minikube cluster${refreshCountIndicator(refreshCount)}</h1>
        <p>Current Status</p>
        <pre><code>${htmlEscape(failed.error[0])}</code></pre>
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

function minikubeModeChanged(previousData: any): boolean {
    return previousData.minikubeusewsl !== undefined &&
        (previousData.minikubeusewsl === true || previousData.minikubeusewsl === 'true') !== !!getUseWsl();
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
