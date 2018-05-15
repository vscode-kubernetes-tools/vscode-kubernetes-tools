import { ShellResult } from "./shell";

export interface Succeeded<T> {
    readonly succeeded: true;
    readonly result: T;
}

export interface Failed {
    readonly succeeded: false;
    readonly error: string[];
}

export type Errorable<T> = Succeeded<T> | Failed;

export function succeeded<T>(e: Errorable<T>): e is Succeeded<T> {
    return e.succeeded;
}

export function failed<T>(e: Errorable<T>): e is Failed {
    return !e.succeeded;
}

export interface ActionResult<T> {
    readonly actionDescription: string;
    readonly result: Errorable<T>;
}

export interface Diagnostic {
    readonly value: string;
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

export function fromShellExitCodeAndStandardError(sr: ShellResult): Errorable<Diagnostic> {
    if (sr.code === 0 && !sr.stderr) {
        return { succeeded: true, result: { value: sr.stderr } };
    }
    return { succeeded: false, error: [ sr.stderr ] };
}

export function fromShellExitCodeOnly(sr: ShellResult): Errorable<Diagnostic> {
    if (sr.code === 0) {
        return { succeeded: true, result: { value: sr.stderr } };
    }
    return { succeeded: false, error: [ sr.stderr ] };
}

export function fromShellJson<T>(sr: ShellResult, processor?: (raw: any) => T): Errorable<T> {
    if (sr.code === 0 && !sr.stderr) {
        const raw: any = JSON.parse(sr.stdout);
        const result = processor ? processor(raw) : (raw as T);
        return { succeeded: true, result: result };
    }
    return { succeeded: false, error: [ sr.stderr ] };
}

