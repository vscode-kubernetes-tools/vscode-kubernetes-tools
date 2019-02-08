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
        this.panel.title = `Logs - ${this.resource}`;
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
            <div style='position: fixed; top: 15px; left: 2%; width: 100%'>
                <span style='position: absolute; left: 0%'>Show log entries</span>
                <select id='mode' style='margin-bottom: 5px; position: absolute; left: 110px' onchange='eval()'>
                    <option value='all'>all</option>
                    <option value='include'>that match</option>
                    <option value='exclude'>that don't match</option>
                    <option value='after'>after match</option>
                    <option value='before'>before match</option>
                </select>
                <span style='position: absolute; left: 240px'>Match expression</span>
                <input style='left:350px; position: absolute' type='text' id='regexp' onkeyup='eval()' placeholder='Filter' size='25'/>
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
                        case 'all':
                            content = orig;
                            break;
                        case 'include':
                            content = orig.filter((line) => regex.test(line));
                            break;
                        case 'exclude':
                            content = orig.filter((line) => !regex.test(line));
                            break;
                        case 'before':
                            content = [];
                            for (const line of orig) {
                                if (regex.test(line)) {
                                    break;
                                }
                                content.push(line);
                            }
                            break;
                        case 'after':
                            const i = orig.findIndex((line) => {
                                return regex.test(line)
                            });
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
