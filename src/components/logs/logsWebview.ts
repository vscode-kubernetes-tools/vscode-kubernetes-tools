import * as vscode from 'vscode';
import { WebPanel } from '../webpanel/webpanel';
import { RunningProcess } from '../../binutilplusplus';
import * as path from 'path';
import { fs } from '../../fs';
import { Container } from '../../kuberesources.objectmodel';
import { Kubectl } from '../../kubectl';
import { getLogsForContainer, LogsDisplayMode } from '../kubectl/logs';

export class LogsPanel extends WebPanel {
    public static readonly viewType = 'vscodeKubernetesLogs';
    public static currentPanels = new Map<string, LogsPanel>();
    private static extensionPath: string;
    private static kubectl: Kubectl;
    private namespace: string | undefined;
    private kindName: string;

    public appendContentProcess: RunningProcess | undefined;

    public static createOrShow(content: string, namespace: string | undefined, kindName: string, containers: Container[], kubectl: Kubectl): LogsPanel {
        const fn = (panel: vscode.WebviewPanel, content: string, _resource: string): LogsPanel => {
            return new LogsPanel(panel, content, namespace, kindName, containers);
        };
        LogsPanel.kubectl = kubectl;
        LogsPanel.extensionPath = vscode.extensions.getExtension('ms-kubernetes-tools.vscode-kubernetes-tools')!.extensionPath;
        const localResourceRoot = vscode.Uri.file(path.join(LogsPanel.extensionPath, 'dist', 'logView'));
        return WebPanel.createOrShowInternal<LogsPanel>(content, `${namespace}/${kindName}`, LogsPanel.viewType, "Kubernetes Logs", LogsPanel.currentPanels, [localResourceRoot], fn);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        content: string,
        namespace: string | undefined,
        kindName: string,
        containers: Container[]
    ) {
        super(panel, content, `${namespace}/${kindName}`, LogsPanel.currentPanels);
        this.namespace = namespace;
        this.kindName = kindName;
        this.addActions(panel);
        this.setContainers(containers);
    }

    public addActions(panel: vscode.WebviewPanel) {
        panel.webview.onDidReceiveMessage(async (event)  => {
            if (event.command === 'start') {
                const options = JSON.parse(event.options);
                getLogsForContainer(
                    this,
                    LogsPanel.kubectl,
                    this.namespace,
                    this.kindName,
                    options.container,
                    options.follow ? LogsDisplayMode.Follow : LogsDisplayMode.Show,
                    options.timestamp,
                    options.since,
                    options.tail,
                    options.terminal);
            } else if (event.command === 'stop') {
                this.deleteAppendContentProcess();
            }
        });
    }

    private setContainers(containers: Container[]) {
        this.panel.webview.postMessage({
            command: 'init',
            containers: containers.map((container) => container.name),
            colors: this.getColors()
        });
    }

    private getColors() {
        return fs.readFileSync(path.join(LogsPanel.extensionPath, 'log-colors-rules.json'), 'utf8');
    }

    public addContent(content: string) {
        this.panel.webview.postMessage({
            command: 'content',
            text: content,
        });
    }

    public setAppendContentProcess(proc: RunningProcess) {
        this.deleteAppendContentProcess();
        this.appendContentProcess = proc;
    }

    public deleteAppendContentProcess() {
        if (this.appendContentProcess) {
            this.appendContentProcess.terminate();
            this.appendContentProcess = undefined;
        }
    }

    protected update() {
        this.panel.title = `Logs - ${this.resource}`;
        this.panel.webview.html = this.getHtmlForWebview();
    }

    protected dispose() {
        this.deleteAppendContentProcess();
        super.dispose(LogsPanel.currentPanels);
    }

    private getHtmlForWebview(): string {
        // Local path to main script run in the webview
        const logViewAppRootOnDisk = path.join(LogsPanel.extensionPath, 'dist', 'logView');
        const logIndexJSPathOnDisk = vscode.Uri.file(
            path.join(logViewAppRootOnDisk, 'index.js'),
        );
        const logIndexJSSrc = this.panel.webview.asWebviewUri(logIndexJSPathOnDisk);

        const webviewElementsPath = vscode.Uri.file(
            path.join(logViewAppRootOnDisk, 'webviewElements.js')
        );
        const webviewElementsSrc = this.panel.webview.asWebviewUri(webviewElementsPath);
        const htmlString: string = fs.readFileSync(path.join(logViewAppRootOnDisk, 'index.html'), 'utf8');
        const meta = `<meta http-equiv="Content-Security-Policy"
        content="connect-src *;
            default-src 'none';
            img-src https:;
            script-src 'unsafe-eval' 'unsafe-inline' vscode-resource:;
            style-src vscode-resource: 'unsafe-inline';">`;
        return `${htmlString}`
            .replace('index.js', `${logIndexJSSrc}`)
            .replace('webviewElements.js', `${webviewElementsSrc}`)
            .replace('<!-- meta http-equiv="Content-Security-Policy" -->', meta);
    }

}
