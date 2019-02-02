import * as vscode from 'vscode';
import { WebPanel } from '../webpanel/webpanel';

export class LogsPanel extends WebPanel {
    public static readonly viewType = 'vscodeKubernetesLogs';
    public static currentPanels = new Map<string, LogsPanel>();

    public static createOrShow(content: string, resource: string): LogsPanel {
        const fn = (panel: vscode.WebviewPanel, content: string, resource: string): LogsPanel => {
            return new LogsPanel(panel, content, resource);
        };
        return WebPanel.createOrShowInternal<LogsPanel>(content, resource, LogsPanel.viewType, "Kubernetes Logs", LogsPanel.currentPanels, fn);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        content: string,
        resource: string
    ) {
        super(panel, content, resource, LogsPanel.currentPanels);
    }

    protected update() {
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
