'use strict';

import { TextDocumentContentProvider, Uri, EventEmitter, Event, ProviderResult, CancellationToken } from 'vscode';
import { Shell } from './shell';
import { FS } from './fs';
import { Advanceable, Errorable, UIRequest, StageData, OperationState, OperationMap } from './wizard';

export const uriScheme : string = "k8screatecluster";

export function operationUri(operationId: string) : Uri {
    return Uri.parse(`${uriScheme}://operations/${operationId}`);
}

export function uiProvider(fs: FS, shell: Shell) : TextDocumentContentProvider & Advanceable {
    return new UIProvider(fs, shell);
}

enum OperationStage {
    Initial,
//    PromptForSubscription,
//    PromptForCluster,
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
                last: listClusterTypes(context),
                stage: OperationStage.Complete
            };
        default:
            return {
                stage: sourceState.stage,
                last: sourceState.last
            };
    }
}

function listClusterTypes(context: Context) : StageData {
    // list subs
    const clusterTypes = [
        'Azure Kubernetes Service',
        'Azure Container Service'
    ];
    return {
        actionDescription: 'listing cluster types',
        result: { succeeded: true, result: clusterTypes, error: [] }
    };
}

function render(operationId: string, state: OperationState<OperationStage>) : string {
    switch (state.stage) {
        case OperationStage.Initial:
             return renderInitial();
        // case OperationStage.PromptForSubscription:
        //     return renderPromptForSubscription(operationId, state.last);
        // case OperationStage.PromptForCluster:
        //     return renderPromptForCluster(operationId, state.last);
        case OperationStage.Complete:
            return renderComplete(state.last);
        default:
            return internalError(`Unknown operation stage ${state.stage}`);
    }
}

function renderInitial() : string {
    return '<!-- Initial --><h1>Listing cluster types</h1><p>Please wait...</p>';
}

function renderComplete(last: StageData) : string {
    const title = last.result.succeeded ? 'Creating cluster' : `Error ${last.actionDescription}`;
    const createResult = last.result.result;
    const clusterTypes = createResult as string[];
    const message = `<p>clusterTypes = ${clusterTypes.join(', ')}</p>`;
    return `<!-- Complete -->
            <h1>${title}</h1>
            ${styles()}
            ${message}`;
}

// TODO: consider consolidating internalError() and styles() with acs
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

