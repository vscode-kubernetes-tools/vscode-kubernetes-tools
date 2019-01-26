import * as path from 'path';
import * as vscode from 'vscode';

export class LogsPanel {
    public static readonly viewType = 'vscodeKubernetesLogs';
    public static currentPanels = [];

    private disposables: vscode.Disposable[] = [];
    private content: string;
    private resource: string;

    public static createOrShow(extensionPath: string, content: string, resource: string): LogsPanel {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        // If we already have a panel, show it.
        const currentPanel = LogsPanel.currentPanels[resource];
        if (currentPanel) {
            currentPanel.setInfo(content, resource);
            currentPanel.update();
            currentPanel.panel.reveal(column);
            return currentPanel;
        }
        const panel = vscode.window.createWebviewPanel(LogsPanel.viewType, "Kubernetes Logs", column || vscode.ViewColumn.One, {
            enableScripts: true,

            // And restrict the webview to only loading content from our extension's `media` directory.
            localResourceRoots: [
            ],
        });

        const result = new LogsPanel(panel, content, resource);
        LogsPanel.currentPanels[resource] = result;
        return result;
    }

    private constructor(
        private readonly panel: vscode.WebviewPanel,
        content: string,
        resource: string
    ) {
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

    public setInfo(content: string, resource: string) {
        this.content = content;
        this.resource = resource;
        this.update();
    }

    public dispose() {
        delete LogsPanel.currentPanels[this.resource];

        this.panel.dispose();

        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private update() {
        this.panel.title = `Kubernetes logs ${this.resource}`;
        this.panel.webview.html = `
        <!doctype html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Kubernetes logs ${this.resource}</title>
            <script
                src="https://code.jquery.com/jquery-3.3.1.min.js"
                integrity="sha256-FgpCb/KJQlLNfOu91ta32o/NMZxltwRo8QtmkMRdAu8="
                crossorigin="anonymous"></script>
        </head>
        <body>
            <div style='position: absolute; top: 15px; left: 75%'>
                <select id='mode' style='margin-bottom: 5px' onchange='eval()'>
                    <option value='include'>Show Matches</option>
                    <option value='exclude'>Hide Matches</option>
                    <option value='after'>Show logs after match</option>
                    <option value='before'>Show logs before match</option>
                </select>
                <input type='text' id='regexp' onkeyup='eval()' placeholder='Regular Expression Filter' size='25'/>
            </div>
            <div style='margin-top: 35px'>
                <div id='content' style="overflow-y: scroll; width: 100%; height: 100%"></div>
            </div>
            <script>
              var orig = \`${this.content}\`.split('\\n');
              var eval = () => {
                var regexp = $('#regexp').val().trim();
                // TODO: This could really be improved to avoid the double loop and list construction.
                if (regexp.length > 0) {
                    var mode = $('#mode').val();
                    var regex = new RegExp(regexp);
                    switch (mode) {
                        case 'include':
                            content = orig.filter((line) => regex.test(line));
                            break;
                        case 'exclude':
                            content = orig.filter((line) => !regex.test(line));
                            break;
                        case 'before':
                            content = [];
                            for (var i = 0; i < orig.length; i++) {
                                var line = orig[i];
                                if (regex.test(line)) {
                                    break;
                                }
                                content.push(line);
                            }
                            break;
                        case 'after':
                            var i = 0;
                            for (; i < orig.length; i++) {
                                var line = orig[i];
                                if (regex.test(line)) {
                                    break;
                                }
                            }
                            content = orig.slice(i+1);
                            break;
                    }
                } else {
                    content = orig;
                }
                $('#content').html('<code><pre>' + content.join('\\n') + '</pre></code>');
              };
              eval();
            </script>
            </body>
        </html>`;
    }
}
