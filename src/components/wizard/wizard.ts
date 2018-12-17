import * as vscode from 'vscode';

export const NEXT_FN = "onNext();";

// export const END_DIALOG_FN = "endDialog()";

export class Wizard {
    constructor(readonly w: vscode.WebviewPanel) { }
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
    const wiz = new Wizard(w);

    w.webview.html = html;
    /* const cancelSubscription = */ w.onDidDispose(() => s.onCancel());
    w.webview.onDidReceiveMessage((m) => {
        // cancelSubscription.dispose();
        // w.dispose();
        s.onStep(wiz, m);
    });
    w.reveal();
    return wiz;
}

export async function showPage(wz: Wizard, htmlBody: string): Promise<void> {
    const r = await wz.w.webview.postMessage({ command: 'showPage', html: htmlBody });
    console.log("SHOWPAGE MESSAGE POSTED? " + r);
    wz.w.reveal();

    // return new Promise<Wizard | undefined>((resolve, reject) => {
    //     const nextScript = `<script>
    //     const vscode = acquireVsCodeApi();

    //     function onNext() {
    //         const s = {};
    //         for (const e of document.forms['${formId}'].elements) {
    //             s[e.name] = e.value;
    //         }
    //         vscode.postMessage(s);
    //     }
    //     </script>`;

    //     const html = nextScript + htmlBody;

    //     wz.w.webview.html = html;
    //     // /* const cancelSubscription = */ w.onDidDispose(() => resolve(undefined));
    //     wz.w.webview.onDidReceiveMessage((m) => {
    //         // cancelSubscription.dispose();
    //         // w.dispose();
    //         resolve(m);
    //     });
    //     // w.reveal();
    // });
}

// export function dialog(tabTitle: string, htmlBody: string, formId: string): Promise<{ [key: string]: string }> {
//     return new Promise<any>((resolve, reject) => {
//         const postbackScript = `<script>
//         function ${END_DIALOG_FN} {
//             const vscode = acquireVsCodeApi();
//             const s = {};
//             for (const e of document.forms['${formId}'].elements) {
//                 s[e.name] = e.value;
//             }
//             vscode.postMessage(s);
//         }
//         </script>`;

//         const html = postbackScript + htmlBody;
//         const w = vscode.window.createWebviewPanel('duffle-dialog', tabTitle, vscode.ViewColumn.Active, {
//             retainContextWhenHidden: false,
//             enableScripts: true,
//         });
//         w.webview.html = html;
//         const cancelSubscription = w.onDidDispose(() => resolve(undefined));
//         w.webview.onDidReceiveMessage((m) => {
//             cancelSubscription.dispose();
//             w.dispose();
//             resolve(m);
//         });
//         w.reveal();
//     });
// }
