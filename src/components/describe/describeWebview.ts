import * as vscode from 'vscode';
import { Dictionary } from '../../utils/dictionary';
import { WebPanel } from '../webpanel/webpanel';

export class DescribePanel extends WebPanel {
    public static readonly viewType = 'vscodeKubernetesDescribe';
    public static currentPanels = new Map<string, DescribePanel>();

    public static createOrShow(content: string, resource: string) {
        const fn = (panel: vscode.WebviewPanel, content: string, resource: string): DescribePanel => {
            return new DescribePanel(panel, content, resource);
        };
        WebPanel.createOrShowInternal<DescribePanel>(content, resource, DescribePanel.viewType, "Kubernetes Describe", DescribePanel.currentPanels, fn);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        content: string,
        resource: string
    ) {
        super(panel, content, resource, DescribePanel.currentPanels);
    }

    protected update() {
        this.panel.title = `Kubernetes describe ${this.resource}`;
        this.panel.webview.html = `
    <!doctype html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Kubernetes describe ${this.resource}</title>
    </head>
    <body>
        <code>
            <pre>${this.content}</pre>
        </code>
    </body>
    </html>`;
    }
}
