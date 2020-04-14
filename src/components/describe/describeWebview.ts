import * as vscode from 'vscode';
import { WebPanel } from '../webpanel/webpanel';
import { ExecResult } from '../../binutilplusplus';

export class DescribePanel extends WebPanel {
    public static readonly viewType = 'vscodeKubernetesDescribe';
    private static readonly describeContext = 'vscodeKubernetesDescribeContext';
    private static activePanel: DescribePanel | undefined = undefined;
    public static currentPanels = new Map<string, DescribePanel>();

    public static refreshCommand() {
        if (DescribePanel.activePanel) {
            DescribePanel.activePanel.doRefresh();
        }
    }

    public static createOrShow(content: string, resource: string, refresh: () => Promise<ExecResult>) {
        const fn = (panel: vscode.WebviewPanel, content: string, resource: string): DescribePanel => {
            return new DescribePanel(panel, content, resource, refresh);
        };
        WebPanel.createOrShowInternal<DescribePanel>(content, resource, DescribePanel.viewType, "Kubernetes Describe", DescribePanel.currentPanels, fn);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        content: string,
        resource: string,
        private readonly refresh: () => Promise<ExecResult>
    ) {
        super(panel, content, resource, DescribePanel.currentPanels);

        const setActiveContext = (active: boolean) => {
            vscode.commands.executeCommand('setContext', DescribePanel.describeContext, active);
            DescribePanel.activePanel = active ? this : undefined;
        };

        this.panel.onDidChangeViewState((evt: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
            setActiveContext(evt.webviewPanel.active);
        });
        setActiveContext(true);
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'refresh':
                        await this.doRefresh();
                        break;
                }
            },
            undefined
        );
    }

    private async doRefresh() {
        const result = await this.refresh();
        if (ExecResult.failed(result)) {
            vscode.window.showErrorMessage(ExecResult.failureMessage(result, { whatFailed: 'Error refreshing' }));
            return;
        }
        this.panel.webview.postMessage({
            command: 'content',
            content: result.stdout,
        });
    }

    protected update() {
        this.panel.title = `Kubernetes describe ${this.resource}`;
        this.panel.webview.html = `
    <!doctype html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Kubernetes describe ${this.resource}</title>
        <script>
            const vscode = acquireVsCodeApi();

            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'content':
                        const elt = document.getElementById('content');
                        elt.innerText = message.content;
                }
            });
        </script>
    </head>
    <body>
        <code>
            <pre id='content'>${this.content}</pre>
        </code>
    </body>
    </html>`;
    }
}
