export interface Advanceable {
    start(operationId: string) : void;
    next(request: UIRequest): Promise<void>;
}

export interface Errorable<T> {
    readonly succeeded: boolean;
    readonly result: T;
    readonly error: string[];
}

export interface UIRequest {
    readonly operationId: string;
    readonly requestData: string;
}

export interface StageData {
    readonly actionDescription: string;
    readonly result: Errorable<any>;
}

export interface OperationState<TStage> {
    readonly stage: TStage;
    readonly last: StageData;
}

export class OperationMap<TStage> {
    private operations: any = {};

    set(operationId: string, operationState: OperationState<TStage>) {
        this.operations[operationId] = operationState;
    }

    get(operationId: string) : OperationState<TStage> {
        return this.operations[operationId];
    }

}

export function advanceUri(commandName: string, operationId: string, requestData: string) : string {
    const request : UIRequest = {
        operationId: operationId,
        requestData: requestData
    };
    const uri = encodeURI(`command:extension.${commandName}?` + JSON.stringify(request));
    return uri;
}

export function selectionChangedScript(commandName: string, operationId: string) : string {
    const js = `
function selectionChanged() {
    var selectCtrl = document.getElementById('selector');
    var selection = selectCtrl.options[selectCtrl.selectedIndex].value;
    var request = '{"operationId":"${operationId}","requestData":"' + selection + '"}';
    document.getElementById('nextlink').href = encodeURI('command:extension.${commandName}?' + request);
}
`;

    return script(js);
}

export interface ControlMapping {
    readonly ctrlName : string;
    readonly extractVal : string;
    readonly jsonKey : string;
}

export function selectionChangedScriptMulti(commandName: string, operationId: string, mappings: ControlMapping[]) : string {
    let gatherRequestJs = "";
    for (const mapping of mappings) {
        const ctrlName : string = mapping.ctrlName;
        const extractVal : string = mapping.extractVal;
        const jsonKey : string = mapping.jsonKey;
        const mappingJs = `
    var ${jsonKey}Ctrl = document.getElementById('${ctrlName}');
    var ${jsonKey}Value = ${extractVal};
    selection = selection + '\\\\"${jsonKey}\\\\":\\\\"' + ${jsonKey}Value + '\\\\",';
`;
        gatherRequestJs = gatherRequestJs + mappingJs;
    }

    const js = `
function selectionChanged() {
    var selection = "{";
    ${gatherRequestJs}
    selection = selection.slice(0, -1) + "}";
    var request = '{"operationId":"${operationId}","requestData":"' + selection + '"}';
    document.getElementById('nextlink').href = encodeURI('command:extension.${commandName}?' + request);
    var u = document.getElementById('uri');
    if (u) { u.innerText = document.getElementById('nextlink').href; }
}
`;

    return script(js);
}

export function script(text: string) : string {
    return `
<script>
${text}
</script>
`;
}

export function waitScript(title: string) : string {
    const js = `
function promptWait() {
    document.getElementById('h').innerText = '${title}';
    document.getElementById('content').style.visibility = 'hidden';
}
`;
    return script(js);
}

export function extend(source: Errorable<any>, transformer: (o: any) => any) : Errorable<any> {
    return {
        succeeded: source.succeeded, 
        result: transformer(source.result),
        error: source.error
    };
}

export function styles() : string {
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

