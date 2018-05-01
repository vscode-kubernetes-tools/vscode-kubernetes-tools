import { ShellResult } from "./shell";

export interface Errorable<T> {
    readonly succeeded: boolean;
    readonly result: T;
    readonly error: string[];
}

export interface ActionResult<T> {
    readonly actionDescription: string;
    readonly result: Errorable<T>;
}

export function selectionChangedScript(commandName: string, operationId: string): string {
    const js = `
function selectionChanged() {
    var selectCtrl = document.getElementById('selector');
    if (!selectCtrl.options[selectCtrl.selectedIndex]) {
        return;
    }
    var selection = selectCtrl.options[selectCtrl.selectedIndex].value;
    var request = '{"operationId":"${operationId}","requestData":"' + selection + '"}';
    document.getElementById('nextlink').href = encodeURI('command:extension.${commandName}?' + request);
}
`;

    return script(js);
}

export function script(text: string): string {
    return `
<script>
${text}
</script>
`;
}

export function waitScript(title: string): string {
    const js = `
function promptWait() {
    document.getElementById('h').innerText = '${title}';
    document.getElementById('content').style.visibility = 'hidden';
}
`;
    return script(js);
}

export function styles(): string {
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

export function formStyles(): string {
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

export function fromShellExitCodeAndStandardError(sr: ShellResult): Errorable<void> {
    if (sr.code === 0 && !sr.stderr) {
        return { succeeded: true, result: null, error: [] };
    }
    return { succeeded: false, result: null, error: [ sr.stderr ] };
}

export function fromShellExitCodeOnly(sr: ShellResult): Errorable<void> {
    return { succeeded: sr.code === 0, result: null, error: [ sr.stderr ] };
}

export function fromShellJson<T>(sr: ShellResult, processor?: (raw: any) => T): Errorable<T> {
    if (sr.code === 0 && !sr.stderr) {
        const raw: any = JSON.parse(sr.stdout);
        const result = processor ? processor(raw) : (raw as T);
        return { succeeded: true, result: result, error: [] };
    }
    return { succeeded: false, result: undefined, error: [ sr.stderr ] };
}

