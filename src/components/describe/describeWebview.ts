import * as vscode from 'vscode';
import { ShellResult } from '../../shell';
import { WebPanel } from '../webpanel/webpanel';

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

    public static createOrShow(content: string, resource: string, refresh: () => Promise<ShellResult | undefined>) {
        const fn = (panel: vscode.WebviewPanel, content: string, resource: string): DescribePanel => {
            return new DescribePanel(panel, content, resource, refresh);
        };
        WebPanel.createOrShowInternal<DescribePanel>(content, resource, DescribePanel.viewType, "Kubernetes Describe", DescribePanel.currentPanels, fn);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        content: string,
        resource: string,
        readonly refresh: () => Promise<ShellResult | undefined>
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

    protected async doRefresh() {
        const result = await this.refresh();
        if (!result) {
            vscode.window.showErrorMessage('Error refreshing!');
            return;
        }
        if (result.code !== 0) {
            vscode.window.showErrorMessage(`Error refreshing: ${result.stderr}`);
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
            const requestRefresh = () => {
                vscode.postMessage({
                    command: 'refresh'
                });
            };

            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'content':
                        console.log('refresh');
                        const elt = document.getElementById('content');
                        elt.innerText = message.content;
                }
            });

            const automaticRefresh = () => {
                const elt = document.getElementById('refresh');
                const val = parseInt(elt.value);
                if (val > 0) {
                    setTimeout(() => {
                        requestRefresh();
                        automaticRefresh();
                    }, val * 1000);
                }
            };
        </script>
    </head>
    <body>
        <code>
            <pre id='content'>${this.content}</pre>
        </code>
        <script>
            automaticRefresh();
        </script>
    </body>
    </html>`;
    }
}
