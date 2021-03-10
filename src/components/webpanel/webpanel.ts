import * as vscode from 'vscode';
import { RpcExtension } from '@sap-devx/webview-rpc/out.ext/rpc-extension';
import { Container } from '../../kuberesources.objectmodel';

export abstract class WebPanel {
    private disposables: vscode.Disposable[] = [];
    protected content: string;
    protected resource: string;
    protected namespace: string | undefined;
    protected kindName: string;
    protected webView: vscode.Webview;
    protected rpc: RpcExtension;

    protected static createOrShowInternal<T extends WebPanel>(content: string, namespace: string | undefined, kindName: string, viewType: string, title: string, containers: Container[], currentPanels: Map<string, T>, localResourceRoots: vscode.Uri[], fn: (p: vscode.WebviewPanel, content: string, namespace: string | undefined, kindName: string, containers: Container[]) => T): T {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        // If we already have a panel, show it.
        const currentPanel = currentPanels.get(`${namespace}/${kindName}`);
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
        const result = fn(panel, content, namespace, kindName, containers);
        currentPanels.set(`${namespace}/${kindName}`, result);
        return result;
    }

    protected constructor(
        protected readonly panel: vscode.WebviewPanel,
        content: string,
        namespace: string | undefined,
        kindName: string,
        currentPanels: Map<string, WebPanel>
    ) {
        this.content = content;
        this.resource = `${namespace}/${kindName}`;
        this.namespace = namespace;
        this.kindName = kindName;
        this.webView = panel.webview;
        this.rpc = new RpcExtension(this.webView);

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
