import * as path from "path";
import * as vscode from "vscode";

import { IDebugProvider, PortInfo } from "./debugProvider";
import { suggestedShellForContainer } from '../utils/container-shell';
import * as config from '../components/config/config';
import { Kubectl } from "../kubectl";
import { kubeChannel } from "../kubeChannel";
import { ProcessInfo } from "./debugUtils";

const debuggerType = 'nodejs';

export class NodejsDebugProvider implements IDebugProvider {
    remoteRoot: string | undefined;
    shell: string;

    public getDebuggerType(): string {
        return debuggerType;
    }

    public async isDebuggerInstalled(): Promise<boolean> {
        return true;
    }

    public async startDebugging(workspaceFolder: string, sessionName: string, port: number | undefined, pod: string, pidToDebug: number | undefined): Promise<boolean> {

        const debugConfiguration: vscode.DebugConfiguration = {
            type: "node",
            request: "attach",
            name: sessionName,
            hostName: "localhost",
            skipFiles: [
                "<node_internals>/**/*.js"
            ],
            port
        };
        if (this.remoteRoot) {
            debugConfiguration['remoteRoot'] = this.remoteRoot;
        }
        const currentFolder = (vscode.workspace.workspaceFolders || []).find((folder) => folder.name === path.basename(workspaceFolder));
        return await vscode.debug.startDebugging(currentFolder, debugConfiguration);
    }

    isSupportedImage(): boolean {
        return false;
    }

    public async resolvePortsFromFile(): Promise<PortInfo | undefined> {
        return undefined;
    }

    public async resolvePortsFromContainer(kubectl: Kubectl, pod: string, podNamespace: string, container: string): Promise<PortInfo | undefined> {
        this.shell = await suggestedShellForContainer(kubectl, pod, podNamespace, container);
        const inspectModeResult = await this.setNodeInspectMode(kubectl, pod, podNamespace, container);
        if (!inspectModeResult) {
            kubeChannel.showOutput('Unable to set Node.js in the container to inspect mode.');
            return undefined;
        }
        this.remoteRoot = await this.tryGetRemoteRoot(kubectl, pod, podNamespace, container);
        const rawDebugPortInfo = config.getNodejsDebugPort() || 9229;
        return {
            debugPort: Number(rawDebugPortInfo)
        };
    }

    async setNodeInspectMode(kubectl: Kubectl, pod: string, podNamespace: string, container: string): Promise<boolean> {
        kubeChannel.showOutput('Switching node to debug mode in container');
        const nsarg = podNamespace ? `--namespace ${podNamespace}` : '';
        // sending SIGUSR1 to a Node.js process will set it in debug (inspect) mode. See https://nodejs.org/en/docs/guides/debugging-getting-started/#enable-inspector
        const containerCommand = container? `-c ${container}` : '';
        const execCmd = `exec ${pod} ${nsarg} ${containerCommand} -- ${this.shell} -c 'kill -s USR1 1'`;
        const execResult = await kubectl.invokeAsync(execCmd);
        return (execResult !== undefined && execResult.code === 0);
    }

    async tryGetRemoteRoot(kubectl: Kubectl, podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<string | undefined> {
        if (config.getNodejsAutoDetectRemoteRoot()) {
            kubeChannel.showOutput("Trying to detect remote root.");
            const nsarg = podNamespace ? `--namespace ${podNamespace}` : '';
            const containerCommand = containerName? `-c ${containerName}` : '';
            const execCmd = `exec ${podName} ${nsarg} ${containerCommand} -- ${this.shell} -c 'readlink /proc/1/cwd'`;
            const execResult = await kubectl.invokeAsync(execCmd);
            if (execResult !== undefined && execResult.code === 0) {
                const remoteRoot = execResult.stdout.replace(/(\r\n|\n|\r)/gm, '');
                kubeChannel.showOutput(`Got remote root from container: ${remoteRoot}`);
                return remoteRoot;
            }
        }
        if (config.getNodejsRemoteRoot()) {
            const remoteRoot = config.getNodejsRemoteRoot();
            kubeChannel.showOutput(`Setting remote root to ${remoteRoot}`);
            return remoteRoot;
        }

        return undefined;
    }

    public filterSupportedProcesses(processes: ProcessInfo[]) : ProcessInfo[] | undefined {
        return undefined
    }

    public isPortRequired(): boolean {
        return true;
    }
}