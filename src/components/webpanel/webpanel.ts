import * as vscode from 'vscode';

export abstract class WebPanel {
    private disposables: vscode.Disposable[] = [];
    protected content: string;
    protected resource: string;
    protected webView: vscode.Webview;

    protected static createOrShowInternal<T extends WebPanel>(content: string, resource: string, viewType: string, title: string, currentPanels: Map<string, T>, localResourceRoots: vscode.Uri[], fn: (p: vscode.WebviewPanel, content: string, resource: string) => T): T {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        // If we already have a panel, show it.
        const currentPanel = currentPanels.get(resource);
        if (currentPanel) {
            currentPanel.setContent(content);
            currentPanel.panel.reveal(column);
            return currentPanel;
        }
        const panel = vscode.window.createWebviewPanel(viewType, title, column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            // And restrict the webview to only loading content from our extension's `media` directory.
            localResourceRoots
        });
        const result = fn(panel, content, resource);
        currentPanels.set(resource, result);
        return result;
    }

    protected constructor(
        protected readonly panel: vscode.WebviewPanel,
        content: string,
        resource: string,
        currentPanels: Map<string, WebPanel>
    ) {
        this.content = content;
        this.resource = resource;
        this.webView = panel.webview;

        this.update();
        this.panel.onDidDispose(() => this.dispose(currentPanels), null, this.disposables);

        this.panel.onDidChangeViewState(() => {
            if (this.panel.visible) {
                this.update();
            }
        }, null, this.disposables);
    }

    public setContent(content: string) {
        this.content = content;
        this.update();
    }

    protected dispose<T extends WebPanel>(currentPanels: Map<string, T>) {
        currentPanels.delete(this.resource);

        this.panel.dispose();

        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    protected abstract update(): void;

}
