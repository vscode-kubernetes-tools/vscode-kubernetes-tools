import * as vscode from 'vscode';

export class DescribePanel {
	public static readonly viewType = 'vscodeKubernetesDescribe';
	public static currentPanel = null;

	private readonly panel: vscode.WebviewPanel;
    private readonly extensionPath: string;
    private content: string;
	private resource: string;

	private disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionPath: string, content: string, resource: string) {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		// If we already have a panel, show it.
		if (DescribePanel.currentPanel) {
			DescribePanel.currentPanel.setContent(content);
			DescribePanel.currentPanel.update();
			DescribePanel.currentPanel.panel.reveal(column);
			return;
		}
		const panel = vscode.window.createWebviewPanel(DescribePanel.viewType, "Kubernetes Describe", column || vscode.ViewColumn.One, {
			enableScripts: false,

			// And restrict the webview to only loading content from our extension's `media` directory.
			localResourceRoots: [
			]
		});

		DescribePanel.currentPanel = new DescribePanel(panel, extensionPath, content, resource);
	}

	public static revive(panel: vscode.WebviewPanel, extensionPath: string) {
		DescribePanel.currentPanel = new DescribePanel(panel, extensionPath, '', '');
	}

	private constructor(
		panel: vscode.WebviewPanel,
        extensionPath: string,
		content: string,
		resource: string
	) {
		this.panel = panel;
        this.extensionPath = extensionPath;
		this.content = content;
		this.resource = resource;

		this.update();
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

		this.panel.onDidChangeViewState((e: any) => {
			if (this.panel.visible) {
				this.update();
			}
		}, null, this.disposables);
	}

    public setContent(content: string) {
        this.content = content;
    }

	public dispose() {
		this.panel.dispose();

		while (this.disposables.length) {
			const x = this.disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private update() {
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
