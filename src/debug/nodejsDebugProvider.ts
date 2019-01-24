import * as path from "path";
import * as vscode from "vscode";
import { ChildProcess } from "child_process";

import { IDebugProvider, PortInfo } from "./debugProvider";
import * as config from '../components/config/config';
import { Kubectl } from "../kubectl";
import { IDockerfile } from "../docker/parser";
import { kubeChannel } from "../kubeChannel";

interface ExecResult {
    readonly proxyProcess: ChildProcess;
}
const debuggerType = 'nodejs';

export class NodejsDebugProvider implements IDebugProvider {
    remoteRoot: String;
    shell: string;
    public getDebuggerType(): string {
        return debuggerType;
    }
    public async isDebuggerInstalled(): Promise<boolean> {
        return true;
    }
    public async startDebugging(workspaceFolder: string, sessionName: string, port: number): Promise<boolean> {

        const debugConfiguration = {
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
        const currentFolder = vscode.workspace.workspaceFolders.find((folder) => folder.name === path.basename(workspaceFolder));
        return await vscode.debug.startDebugging(currentFolder, debugConfiguration);
    }
    isSupportedImage(baseImage: string): boolean {
        throw new Error("Method not implemented.");
    }

    resolvePortsFromFile(dockerfile: IDockerfile, env: {}): Promise<PortInfo> {
        throw new Error("Method not implemented.");
    }

    public async resolvePortsFromContainer(kubectl: Kubectl, pod: string, podNamespace: string, container: string): Promise<PortInfo> {
        this.shell = await this.suggestedShellForContainer(kubectl, pod, podNamespace, container);
        await this.setNodeInspectMode(kubectl, pod, podNamespace, container);
        this.remoteRoot = await this.tryGetRemoteRoot(kubectl, pod, podNamespace, container);
        const rawDebugPortInfo = config.getNodejsDebugPort() || '9229';
        return {
            debugPort: Number(rawDebugPortInfo)
        };
    }

    async setNodeInspectMode(kubectl: Kubectl, pod: string, podNamespace: string, container: string): Promise<Boolean> {
        kubeChannel.showOutput('Switching node to debug mode in container');
        const nsarg = podNamespace ? `--namespace ${podNamespace}` : '';
        const execCmd = `exec ${pod} ${nsarg} ${container ? "-c ${selectedContainer}" : ""} -- ${this.shell} -c 'kill -SIGUSR1 1'`;
        const execResult = await kubectl.invokeAsync(execCmd);
        return execResult.code === 0;
    }

    async tryGetRemoteRoot(kubectl: Kubectl, podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<String> {
        let remoteRoot: String;
        if (config.getNodejsAutoDetectRemoteRoot()) {
            kubeChannel.showOutput("Trying to detect remote root.");
            const nsarg = podNamespace ? `--namespace ${podNamespace}` : '';
            const execCmd = `exec ${podName} ${nsarg} ${containerName ? "-c ${selectedContainer}" : ""} -- ${this.shell} -c 'readlink /proc/1/cwd'`;
            const execResult = await kubectl.invokeAsync(execCmd);
            if (execResult.code === 0) {
                remoteRoot = execResult.stdout.replace(/(\r\n|\n|\r)/gm, '');
                kubeChannel.showOutput(`Got remote root from container: ${remoteRoot}`);
            }
        }
        else if (config.getNodejsRemoteRoot()) {
            remoteRoot = config.getNodejsRemoteRoot();
            kubeChannel.showOutput(`Setting remote root to ${remoteRoot}`);
        }
        return remoteRoot;
    }

    async isBashOnContainer(kubectl: Kubectl, podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<boolean> {
        const nsarg = podNamespace ? `--namespace ${podNamespace}` : '';
        const result = await kubectl.invokeAsync(`exec ${podName} ${nsarg} ${containerName ? "-c ${selectedContainer}" : ""} -- ls -la /bin/bash`);
        return !result.code;
    }

    async suggestedShellForContainer(kubectl: Kubectl, podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<string> {
        if (await this.isBashOnContainer(kubectl, podName, podNamespace, containerName)) {
            return 'bash';
        }
        return 'sh';
    }
}