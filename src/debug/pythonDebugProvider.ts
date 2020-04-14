import * as path from "path";
import * as vscode from "vscode";

import { IDebugProvider, PortInfo } from "./debugProvider";
import { suggestedShellForContainer } from '../utils/container-shell';
import * as config from '../components/config/config';
import * as extensionUtils from "../extensionUtils";
import { Kubectl } from "../kubectl";
import { kubeChannel } from "../kubeChannel";
import { ProcessInfo } from "./debugUtils";
import { ExecResult } from "../binutilplusplus";

const debuggerType = 'python';
const defaultPythonDebuggerExtensionId = 'ms-python.python';

export class PythonDebugProvider implements IDebugProvider {
    remoteRoot: string | undefined;
    shell: string;

    public getDebuggerType(): string {
        return debuggerType;
    }

    public async isDebuggerInstalled(): Promise<boolean> {
        if (vscode.extensions.getExtension(defaultPythonDebuggerExtensionId)) {
            return true;
        }
        const answer = await vscode.window.showInformationMessage(`Python debugging requires the '${defaultPythonDebuggerExtensionId}' extension. Would you like to install it now?`, "Install Now");
        if (answer === "Install Now") {
            return await extensionUtils.installVscodeExtension(defaultPythonDebuggerExtensionId);
        }
        return false;
    }

    public async startDebugging(workspaceFolder: string, sessionName: string, port: number | undefined, _pod: string, _pidToDebug: number | undefined): Promise<boolean> {
        const debugConfiguration: vscode.DebugConfiguration = {
            type: "python",
            request: "attach",
            name: sessionName,
            hostName: "localhost",
            port
        };
        const currentFolder = (vscode.workspace.workspaceFolders || []).find((folder) => folder.name === path.basename(workspaceFolder));
        if (currentFolder && this.remoteRoot) {
            debugConfiguration['pathMappings'] = [{
                localRoot: workspaceFolder,
                remoteRoot: this.remoteRoot
            }];
        }
        return await vscode.debug.startDebugging(currentFolder, debugConfiguration);
    }

    public isSupportedImage(baseImage: string): boolean {
        if (!baseImage) {
            return false;
        }
        return baseImage.indexOf("python") >= 0;
    }

    public async resolvePortsFromFile(): Promise<PortInfo | undefined> {
        return undefined;
    }

    public async resolvePortsFromContainer(kubectl: Kubectl, pod: string, podNamespace: string, container: string): Promise<PortInfo | undefined> {
        this.shell = await suggestedShellForContainer(kubectl, pod, podNamespace, container);
        this.remoteRoot = await this.tryGetRemoteRoot(kubectl, pod, podNamespace, container);
        const rawDebugPortInfo = config.getPythonDebugPort() || 5678;
        return {
            debugPort: Number(rawDebugPortInfo)
        };
    }

    async tryGetRemoteRoot(kubectl: Kubectl, podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<string | undefined> {
        if (config.getPythonAutoDetectRemoteRoot()) {
            kubeChannel.showOutput("Trying to detect remote root.");
            const nsarg = podNamespace ? `--namespace ${podNamespace}` : '';
            const containerCommand = containerName? `-c ${containerName}` : '';
            const execCmd = `exec ${podName} ${nsarg} ${containerCommand} -- ${this.shell} -c 'readlink /proc/1/cwd'`;
            const execResult = await kubectl.invokeCommand(execCmd);
            if (ExecResult.succeeded(execResult)) {
                const remoteRoot = execResult.stdout.replace(/(\r\n|\n|\r)/gm, '');
                kubeChannel.showOutput(`Got remote root from container: ${remoteRoot}`);
                return remoteRoot;
            }
        }
        if (config.getPythonRemoteRoot()) {
            const remoteRoot = config.getPythonRemoteRoot();
            kubeChannel.showOutput(`Setting remote root to ${remoteRoot}`);
            return remoteRoot;
        }

        return undefined;
    }

    public filterSupportedProcesses(_processes: ProcessInfo[]): ProcessInfo[] | undefined {
        return undefined;
    }

    public isPortRequired(): boolean {
        return true;
    }
}
