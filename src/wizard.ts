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
    var request = '{"operationId":"${operationId}", "requestData":"' + selection + '"}';
    document.getElementById('nextlink').href = encodeURI('command:extension.${commandName}?' + request);
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
    document.getElementById('content').innerText = '';
}
`;
    return script(js);
}

export function extend(source: StageData, transformer: (o: any) => any) : StageData {
    return {
        actionDescription: source.actionDescription,
        result: {
            succeeded: source.result.succeeded, 
            result: transformer(source.result.result),
            error: source.result.error
        }
    };
}