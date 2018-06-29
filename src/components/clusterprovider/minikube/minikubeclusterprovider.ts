import * as restify from 'restify';
import * as portfinder from 'portfinder';
import * as clusterproviderregistry from '../clusterproviderregistry';
import { styles, formStyles, waitScript, ActionResult, Diagnostic, fromShellExitCodeOnly } from '../../../wizard';
import { propagationFields, formPage } from '../common/form';
import { refreshExplorer } from '../common/explorer';
import { Errorable, succeeded, failed, Failed, Succeeded } from '../../../errorable';
import { Shell } from '../../../shell';

export interface Context {
    readonly shell: Shell;
    createExec: Promise<any>;
}

type HtmlRequestHandler = (
    step: string | undefined,
    requestData: any,
    context: Context,
) => Promise<string>;

let minikubeWizardServer: restify.Server;

export async function init(registry: clusterproviderregistry.ClusterProviderRegistry, context: Context): Promise<void> {
    if (!minikubeWizardServer) {
        minikubeWizardServer = restify.createServer({
            formatters: {
                'text/html': (req, resp, body) => body
            }
        });

        const port = await portfinder.getPortPromise({ port: 44000 });

        const htmlServer = new HtmlServer(context);
        minikubeWizardServer.use(restify.plugins.queryParser(), restify.plugins.bodyParser());
        minikubeWizardServer.listen(port, '127.0.0.1');

        // You MUST use fat arrow notation for the handler callbacks: passing the
        // function reference directly will foul up the 'this' pointer.
        minikubeWizardServer.get('/create', (req, resp, n) => htmlServer.handleGetCreate(req, resp, n));
        minikubeWizardServer.post('/create', (req, resp, n) => htmlServer.handlePostCreate(req, resp, n));
        minikubeWizardServer.get('/configure', (req, resp, n) => htmlServer.handleGetConfigure(req, resp, n));
        minikubeWizardServer.post('/configure', (req, resp, n) => htmlServer.handlePostConfigure(req, resp, n));

        registry.register({id: 'minikube', displayName: "Minikube local cluster", port: port, supportedActions: ['create','configure']});
    }
}

class HtmlServer {
    constructor(readonly context: Context) {}

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
        const html = await handler(request.query["step"], requestData, this.context);
        response.contentType = 'text/html';
        response.send("<html><body><style id='styleholder'></style>" + html + "</body></html>");

        next();
    }
}

async function getHandleCreateHtml(step: string | undefined, requestData: any, context: Context): Promise<string> {
    if (!step) {
        return await promptForConfiguration(requestData, context, "create", "create");
    } else if (step === "create") {
        return await createCluster(requestData, context);
    } else if (step === "wait") {
        return await waitForClusterAndReportConfigResult(context, requestData);
    } else {
        return renderInternalError(`MinikubeStepError (${step})`);
    }
}

async function getHandleConfigureHtml(step: string | undefined, requestData: any): Promise<string> {
    if (!step || step === "configure") {
        return await configureKubernetes(requestData);
    } else {
        return renderInternalError(`ConfigurationStepError (${step})`);
    }
}

async function promptForConfiguration(previousData: any, context: Context, action: clusterproviderregistry.ClusterProviderAction, nextStep: string): Promise<string> {
    return formPage({
        stepId: 'PromptForConfiguration',
        title: 'Configure Minikube',
        waitText: 'Configuring Minikube',
        action: action,
        nextStep: nextStep,
        submitText: 'Create',
        previousData: previousData,
        formContent: `
        <p>No configuration options (yet)</p>
        `
    });
}

async function configureKubernetes(previousData: any): Promise<string> {
    const selectedCluster = previousData.cluster;
    await refreshExplorer();
    return renderConfigurationResult(); // TODO
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
    const createResult = await runMinikubeCommand(context, 'minikube help');

    context.createExec = context.shell.exec('minikube start');

    const title = createResult.result.succeeded ? 'Cluster creation has started' : `Error ${createResult.actionDescription}`;
    const additionalDiagnostic = diagnoseCreationError(createResult.result);
    const successCliErrorInfo = diagnoseCreationSuccess(createResult.result);
    const message = succeeded(createResult.result) ?
        `<div id='content'>
         ${formStyles()}
         ${styles()}
         <!-- ${waitScript('Checking on minikube cluster')} -->
         <form id='form' action='create?step=wait' method='post' onsubmit='return promptWait();'>
         ${propagationFields(previousData)}
         <p class='success'>Minikube is creating the cluster, but this may take some time. You can now close this window,
         or wait for creation to complete so that we can add the new cluster to your Kubernetes configuration.</p>
         <p><button type='submit' class='link-button'>Wait and add the new cluster &gt;</button></p>
         </form>
         ${successCliErrorInfo}
         </div>` :
        `<p class='error'>An error occurred while creating the cluster. Is 'minikube' installed and in your PATH?</p>
         ${additionalDiagnostic}
         <p><b>Details</b></p>
         <p>${createResult.result.error[0]}</p>`;
    return `<!-- Complete -->
            <h1 id='h'>${title}</h1>
            ${styles()}
            ${waitScript('Waiting for cluster - this will take several minutes')}
            ${message}`;

}

async function waitForClusterAndReportConfigResult(context: Context, previousData: any): Promise<string> {
    const waitResult = await runMinikubeCommand(context, 'minikube status');
    if (!waitResult.result.succeeded) {
        const failed = waitResult.result as Failed;
        return `<h1>Waiting for minikube cluster</h1>
        <p>Current Status</p>
        <pre><code>${failed.error[0]}</code></pre>
        <form id='form' action='create?step=wait' method='post'>
        ${propagationFields(previousData)}
        </form>
        <script>
        window.setTimeout(function() {
            var f = document.getElementById('form');
            f.submit();
        }, 1000)
        </script>
        `;
    }
    await refreshExplorer();

    return renderConfigurationResult();
}

function renderConfigurationResult(): string {
    const title = 'Cluster added';
    const getCliOutput = '';
    const getCredsOutput = '';
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
    return '';
}

function diagnoseCreationSuccess(e: Errorable<Diagnostic>): string {
    if (failed(e) || !e.result || !e.result.value) {
        return '';
    }
    return '';
}

function renderInternalError(error: string): string {
    return `
<h1>Internal extension error</h1>
${styles()}
<p class='error'>An internal error occurred in the vscode-kubernetes-tools extension.</p>
<p>This is not an Azure or Kubernetes issue.  Please report error text '${error}' to the extension authors.</p>
`;
}
