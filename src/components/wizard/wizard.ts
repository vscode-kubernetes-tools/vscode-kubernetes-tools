import * as vscode from 'vscode';
import { Sequence, isObservable, isThenable } from '../../utils/observable';

export const NEXT_FN = "onNext();";

export class Wizard {
    constructor(private readonly w: vscode.WebviewPanel) { }

    async showPage(htmlBody: Sequence<string>): Promise<void> {
        if (isObservable(htmlBody)) {
            const webview = this.w.webview;
            htmlBody.subscribe({
                async onNext(value: string) {
                    return await webview.postMessage({ command: 'showPage', html: value });
                }
            });
        } else if (isThenable(htmlBody)) {
            await this.w.webview.postMessage({ command: 'showPage', html: await htmlBody });
        } else {
            await this.w.webview.postMessage({ command: 'showPage', html: htmlBody });
        }
        this.w.reveal();
    }
}

export interface Subscriber {
    onStep(w: Wizard, m: any): void;
    onCancel(): void;
}

export function createWizard(tabTitle: string, formId: string, s: Subscriber): Wizard {
    const nextScript = `<script>
    const vscode = acquireVsCodeApi();
    const wvcontent = document.getElementById('wvcontent__');

    window.addEventListener('message', (e) => {
        const msg = e.data;
        switch (msg.command) {
            case 'showPage':
                wvcontent.innerHTML = msg.html;
                break;
        }
    });

    function onNext() {
        const s = { };
        for (const e of document.forms['${formId}'].elements) {
            s[e.name] = e.value;
        }
        vscode.postMessage(s);
    }
    </script>`;

    const html = `<div id='wvcontent__' />${nextScript}`;

    const w = vscode.window.createWebviewPanel('vsk8s-dialog', tabTitle, vscode.ViewColumn.Active, {
        retainContextWhenHidden: true,
        enableScripts: true,
    });
    const wizard = new Wizard(w);

    w.webview.html = html;
    w.onDidDispose(() => s.onCancel());
    w.webview.onDidReceiveMessage((m) => {
        s.onStep(wizard, m);
    });
    w.reveal();

    return wizard;
}
