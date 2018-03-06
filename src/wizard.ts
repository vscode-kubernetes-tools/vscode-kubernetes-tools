export interface Errorable<T> {
    readonly succeeded: boolean;
    readonly result: T;
    readonly error: string[];
}

export interface ActionResult<T> {
    readonly actionDescription: string;
    readonly result: Errorable<T>;
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

export function formStyles() : string {
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
.vscode-light .link-button {
    color: navy;
}
.vscode-dark .link-button {
    color: azure;
}
.link-button:focus {
    outline: none;
}
.link-button:active {
    color:red;
}
</style>
`;
}

