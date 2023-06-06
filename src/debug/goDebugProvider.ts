import * as path from "path";
import * as vscode from "vscode";

import { IDebugProvider, PortInfo, Cancellable } from "./debugProvider";
import * as debugUtils from "./debugUtils";
import * as extensionUtils from "../extensionUtils";
import { Kubectl } from "../kubectl";
import { IDockerfile } from "../docker/parser";

const defaultGoDebuggerExtensionId = "golang.go";
const defaultGoDebuggerExtension = "Debugger for Go";
const defaultGoDebuggerConfigType = "go";

const defaultGoAppPort = "8080";
const defaultGoDebugPort = "32768";
const fullGoDebugOptsRegExp = /^dlv debug\s+.*(--listen[\s=][^\s]+)\S*/i;

export class GoDebugProvider implements IDebugProvider {
    public getDebuggerType(): string {
        return defaultGoDebuggerConfigType;
    }

    public async isDebuggerInstalled(): Promise<boolean> {
        if (vscode.extensions.getExtension(defaultGoDebuggerExtensionId)) {
            return true;
        }
        const answer = await vscode.window.showInformationMessage(`Go debugging requires the '${defaultGoDebuggerExtension}' extension. Would you like to install it now?`, "Install Now");
        if (answer === "Install Now") {
            return await extensionUtils.installVscodeExtension(defaultGoDebuggerExtensionId);
        }
        return false;
    }

    public async startDebugging(workspaceFolder: string, sessionName: string, port: number | undefined, _pod: string, _pidToDebug: number | undefined): Promise<boolean> {
        const remotePath = await vscode.window.showInputBox({ 
            prompt: "Which is the project root path of your remote app?", 
            placeHolder: "/go/src/",
            ignoreFocusOut: true,
        });
        if (remotePath === undefined) {
            return false;
        }
        
        const debugConfiguration = {
            type: "go",
            request: "attach",
            mode: "remote",
            name: sessionName,
            hostName: "localhost",
            remotePath,
            port,
            cwd: workspaceFolder,
        };
        const currentFolder = (vscode.workspace.workspaceFolders || []).find((folder) => folder.name === path.basename(workspaceFolder));
        if (!currentFolder) {
            return false;  // shouldn't happen as workspaceFolder should be one of the workspaceFolders
        }
        return await vscode.debug.startDebugging(currentFolder, debugConfiguration);
    }

    public isSupportedImage(baseImage: string): boolean {
        if (!baseImage) {
            return false;
        }
        return baseImage.indexOf("golang") >= 0;
    }

    public async resolvePortsFromFile(dockerfile: IDockerfile, env: {}): Promise<PortInfo | undefined> {
        // Resolve the debug port.
        const rawDebugPortInfo = await debugUtils.promptForDebugPort(defaultGoDebugPort);

        // Resolve the app port.
        const exposedPorts = dockerfile.getExposedPorts();
        const possiblePorts = exposedPorts.length ? exposedPorts.filter((port) => port !== rawDebugPortInfo) : [];
        const rawAppPortInfo = await debugUtils.promptForAppPort(possiblePorts, defaultGoAppPort, env);

        return {
            debugPort: Number(rawDebugPortInfo),
            appPort: Number(rawAppPortInfo)
        };
    }

    public async resolvePortsFromContainer(kubectl: Kubectl, pod: string, podNamespace: string | undefined, container: string): Promise<PortInfo | undefined> {
        let rawDebugPortInfo: string | undefined;
        const processes = await debugUtils.getProcesses(kubectl, pod, podNamespace, container);
        const commandLines = processes ? processes.map(({ command }) => command) : undefined;
        if (commandLines) {
            for (const commandLine of commandLines) {
                // dlv debug --headless --log --api-version=2 --listen=127.0.0.1:2345
                const matches = commandLine.match(fullGoDebugOptsRegExp);
                if (matches && matches.length > 0) {
                    const addresses = matches[1].split(":");
                    rawDebugPortInfo = addresses[addresses.length - 1];
                    break;
                }
            }
        }

        // if --listen=127.0.0.1:0 was specified, we cannot determine the correct listening port as it is randomly selected from the ephemeral port range.
        if (!rawDebugPortInfo || rawDebugPortInfo === "0") {
            rawDebugPortInfo = await debugUtils.promptForDebugPort(defaultGoDebugPort);
        }

        if (!rawDebugPortInfo) {
            return undefined;
        }

        return {
            debugPort: Number(rawDebugPortInfo)
        };
    }

    public filterSupportedProcesses(processes: debugUtils.ProcessInfo[]): debugUtils.ProcessInfo[] | undefined {
        return processes.filter((processInfo) => (processInfo.command.toLowerCase().startsWith('dlv ') ||
                                                  processInfo.command.indexOf('/dlv ') >= 0)); // full path
    }

    public isPortRequired(): boolean {
        return true;
    }

    public async getDebugArgs(): Promise<Cancellable> {
        return { cancelled: false };
    }
}
