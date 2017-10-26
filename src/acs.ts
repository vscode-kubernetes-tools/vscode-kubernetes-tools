'use strict';

import { TextDocumentContentProvider, Uri, EventEmitter, Event, ProviderResult, CancellationToken } from 'vscode';
import { Shell } from './shell';
import { FS } from './fs';

export const uriScheme : string = "acsconfigure";

export function operationUri(operationId: string) : Uri {
    return Uri.parse(`${uriScheme}://operations/${operationId}`);
}

export function uiProvider(fs: FS, shell: Shell) : TextDocumentContentProvider & Advanceable {
    return new UIProvider(fs, shell);
}

export interface Advanceable {
    start(operationId: string) : void;
    next(request: UIRequest): Promise<void>;
}

interface Errorable<T> {
    readonly succeeded: boolean;
    readonly result: T;
    readonly error: string[];
}

export interface UIRequest {
    readonly operationId: string;
    readonly requestData: string;
}

interface StageData {
    readonly actionDescription: string;
    readonly result: Errorable<any>;
}

interface OperationState {
    readonly stage: OperationStage;
    readonly last: StageData;
}

enum OperationStage {
    Initial,
    PromptForSubscription,
    PromptForCluster,
    Complete,
}

class OperationMap {

    private operations: any = {};

    set(operationId: string, operationState: OperationState) {
        this.operations[operationId] = operationState;
    }

    get(operationId: string) : OperationState {
        return this.operations[operationId];
    }

}

interface Context {
    readonly fs: FS;
    readonly shell: Shell;
}

class UIProvider implements TextDocumentContentProvider, Advanceable {

    private readonly context;

    constructor(fs: FS, shell: Shell) {
        this.context = { fs: fs, shell: shell };
    }

	private _onDidChange: EventEmitter<Uri> = new EventEmitter<Uri>();
    readonly onDidChange: Event<Uri> = this._onDidChange.event;

    private operations: OperationMap = new OperationMap;

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

async function next(context: Context, sourceState: OperationState, requestData: string) : Promise<OperationState> {
    switch (sourceState.stage) {
        case OperationStage.Initial:
            return {
                last: await getSubscriptionList(context),
                stage: OperationStage.PromptForSubscription
            };
        case OperationStage.PromptForSubscription:
            const selectedSubscription : string = requestData;
            return {
                last: await getClusterList(context, selectedSubscription),
                stage: OperationStage.PromptForCluster
            };
        case OperationStage.PromptForCluster:
            const selectedCluster = parseCluster(requestData);
            return {
                last: await configureCluster(context, selectedCluster.name, selectedCluster.resourceGroup),
                stage: OperationStage.Complete
            };
        default:
            return {
                stage: sourceState.stage,
                last: sourceState.last
            };
    }
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

async function getClusterList(context: Context, subscription: string) : Promise<StageData> {
    // log in
    const login = await loginAsync(context, subscription);
    if (!login.succeeded) {
        return {
            actionDescription: 'logging into subscription',
            result: login
        };
    }

    // list clusters
    const clusters = await listClustersAsync(context);
    return {
        actionDescription: 'listing clusters',
        result: clusters
    };
}

async function configureCluster(context: Context, clusterName: string, clusterGroup: string) : Promise<StageData> {
    const downloadCliPromise = downloadCli(context);
    const getCredentialsPromise = getCredentials(context, clusterName, clusterGroup);

    const [cliResult, credsResult] = await Promise.all([downloadCliPromise, getCredentialsPromise]);

    const result = {
        gotCli: cliResult.succeeded,
        cliInstallFile: cliResult.installFile,
        cliOnDefaultPath: cliResult.onDefaultPath,
        cliError: cliResult.error,
        gotCredentials: credsResult.succeeded,
        credentialsError: credsResult.error
    };
    
    return {
        actionDescription: 'configuring Kubernetes',
        result: { succeeded: cliResult.succeeded && credsResult.succeeded, result: result, error: [] }  // TODO: this ends up not fitting our structure very well - fix?
    };
}

async function downloadCli(context: Context) : Promise<any> {
    const cliInfo = installCliInfo(context);

    const sr = await context.shell.exec(cliInfo.commandLine);
    if (sr.code === 0) {
        return {
            succeeded: true,
            installFile: cliInfo.installFile,
            onDefaultPath: !context.shell.isWindows()
        };
    } else {
        return {
            succeeded: false,
            error: sr.stderr
        };
    }
}

async function getCredentials(context: Context, clusterName: string, clusterGroup: string) : Promise<any> {
    const cmd = 'az acs kubernetes get-credentials -n ' + clusterName + ' -g ' + clusterGroup;
    const sr = await context.shell.exec(cmd);

    if (sr.code === 0 && !sr.stderr) {
        return {
            succeeded: true
        };
    } else {
        return {
            succeeded: false,
            error: sr.stderr
        };
    }
}

function installCliInfo(context: Context) {
    const cmdCore = 'az acs kubernetes install-cli';
    const isWindows = context.shell.isWindows();
    if (isWindows) {
        // The default Windows install location requires admin permissions; install
        // into a user profile directory instead. We process the path explicitly
        // instead of using %LOCALAPPDATA% in the command, so that we can render the
        // physical path when notifying the user.
        const appDataDir = process.env['LOCALAPPDATA'];
        const installDir = appDataDir + '\\kubectl';
        const installFile = installDir + '\\kubectl.exe';
        const cmd = `(if not exist "${installDir}" md "${installDir}") & ${cmdCore} --install-location="${installFile}"`;
        return { installFile: installFile, commandLine: cmd };
    } else {
        // Bah, the default Linux install location requires admin permissions too!
        // Fortunately, $HOME/bin is on the path albeit not created by default.
        const homeDir = process.env['HOME'];
        const installDir = homeDir + '/bin';
        const installFile = installDir + '/kubectl';
        const cmd = `mkdir -p "${installDir}" ; ${cmdCore} --install-location="${installFile}"`;
        return { installFile: installFile, commandLine: cmd };
    }
}

function render(operationId: string, state: OperationState) : string {
    switch (state.stage) {
        case OperationStage.Initial:
             return renderInitial();
        case OperationStage.PromptForSubscription:
            return renderPromptForSubscription(operationId, state.last);
        case OperationStage.PromptForCluster:
            return renderPromptForCluster(operationId, state.last);
        case OperationStage.Complete:
            return renderComplete(state.last);
        default:
            return internalError(`Unknown operation stage ${state.stage}`);
    }
}

// TODO: Using HTML comments to test that the correct rendering was invoked.
// Would be 'purer' to allow the tests to inject fake rendering methods, as this
// would also allow us to check the data being passed into the rendering method...

function renderInitial() : string {
    return '<!-- Initial --><h1>Listing subscriptions</h1><p>Please wait...</p>';
}

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

function renderPromptForCluster(operationId: string, last: StageData) : string {
    if (!last.result.succeeded) {
        return notifyCliError('PromptForCluster', last);
    }
    const clusters : any[] = last.result.result;
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
<p class='error'>An internal error occurred in the vs-kubernetes extension.</p>
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

function script(text: string) : string {
    return `
<script>
${text}
</script>
`;
}

function waitScript(title: string) : string {
    const js = `
function promptWait() {
    document.getElementById('h').innerText = '${title}';
    document.getElementById('content').innerText = '';
}
`;
    return script(js);
}

function selectionChangedScript(operationId: string) : string {
    const js = `
function selectionChanged() {
    var selectCtrl = document.getElementById('selector');
    var selection = selectCtrl.options[selectCtrl.selectedIndex].value;
    var request = '{"operationId":"${operationId}", "requestData":"' + selection + '"}';
    document.getElementById('nextlink').href = encodeURI('command:extension.vsKubernetesConfigureFromAcs?' + request);
}
`;

    return script(js);
}

function advanceUri(operationId: string, requestData: string) : string {
    const request : UIRequest = {
        operationId: operationId,
        requestData: requestData
    };
    const uri = encodeURI("command:extension.vsKubernetesConfigureFromAcs?" + JSON.stringify(request));
    return uri;
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

async function loginAsync(context: Context, subscription: string) : Promise<Errorable<void>> {
    const sr = await context.shell.exec(`az account set --subscription "${subscription}"`);

    if (sr.code === 0 && !sr.stderr) {
        return { succeeded: true, result: null, error: [] };
    } else {
        return { succeeded: false, result: null, error: [sr.stderr] };
    }
}

async function listClustersAsync(context: Context) : Promise<Errorable<string[]>> {
    let query = '[?orchestratorProfile.orchestratorType==`Kubernetes`].{name:name,resourceGroup:resourceGroup}';
    if (context.shell.isUnix()) {
        query = `'${query}'`;
    }
    const sr = await context.shell.exec(`az acs list --query ${query} -ojson`);

    if (sr.code === 0 && !sr.stderr) {
        const clusters : any[] = JSON.parse(sr.stdout);
        return { succeeded: true, result: clusters, error: [] };
    } else {
        return { succeeded: false, result: [], error: [sr.stderr] };
    }

}
