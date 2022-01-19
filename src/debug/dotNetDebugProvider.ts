import * as path from "path";
import * as vscode from "vscode";

import { IDebugProvider, PortInfo, Cancellable } from "./debugProvider";
import { ProcessInfo } from "./debugUtils";
import * as extensionUtils from "../extensionUtils";
import { Kubectl } from "../kubectl";
import { kubeChannel } from "../kubeChannel";
import { IDockerfile } from "../docker/parser";
import { Dictionary } from "../utils/dictionary";
import * as extensionConfig from '../components/config/config';

// Use the csharp debugger extension provided by Microsoft for csharp debugging.
const defaultDotnetDebuggerExtensionId = "ms-dotnettools.csharp";
const defaultDotnetDebuggerExtension = "C# for Visual Studio Code";

const defaultDotnetDebuggerConfigType = "dotnet";

export class DotNetDebugProvider implements IDebugProvider {
    public getDebuggerType(): string {
        return defaultDotnetDebuggerConfigType;
    }

    public async isDebuggerInstalled(): Promise<boolean> {
        if (vscode.extensions.getExtension(defaultDotnetDebuggerExtensionId)) {
            return true;
        }
        const answer = await vscode.window.showInformationMessage(`Dotnet debugging requires the '${defaultDotnetDebuggerExtension}' extension. Would you like to install it now?`, "Install Now");
        if (answer === "Install Now") {
            return await extensionUtils.installVscodeExtension(defaultDotnetDebuggerExtensionId);
        }
        return false;
    }

    public async startDebugging(workspaceFolder: string, _sessionName: string, _port: number | undefined, pod: string, _pidToDebug: number | undefined): Promise<boolean> {
        const debugConfiguration: vscode.DebugConfiguration = {
            name: ".NET Core Kubernetes Attach",
            type: "coreclr",
            request: "attach",
            pipeTransport: {
                pipeProgram: "kubectl",
                pipeArgs: [ "exec", "-i", pod, "--", "/bin/sh", "-c" ],
                debuggerPath: extensionConfig.getDotnetVsdbgPath(),
                pipeCwd: workspaceFolder,
                quoteArgs: true
            }
        };
        const map = extensionConfig.getDotnetDebugSourceFileMap();
        if (map) {
            try {
                const json: string = `{"${map.replace(/\\/g, "\\\\")}":"${workspaceFolder.replace(/\\/g, "\\\\")}"}`;
                const sourceFileMap: JSON = JSON.parse(json);
                debugConfiguration['sourceFileMap'] = sourceFileMap;
            } catch (error) {
                kubeChannel.showOutput(error.message);
            }
        }
        const currentFolder = (vscode.workspace.workspaceFolders || []).find((folder) => folder.name === path.basename(workspaceFolder));
        const result = await vscode.debug.startDebugging(currentFolder, debugConfiguration);
        if (!result) {
           kubeChannel.showOutput(`${defaultDotnetDebuggerConfigType} debug attach failed for pod ${pod}.\nSee https://github.com/Azure/vscode-kubernetes-tools/blob/master/debug-on-kubernetes.md for troubleshooting.`, "Failed to attach");
        }
        return result;
    }

    public isSupportedImage(_baseImage: string): boolean {
        // todo: add support for debug from file
        return false;
    }

    public async resolvePortsFromFile(_dockerfile: IDockerfile, _env: Dictionary<string>): Promise<PortInfo | undefined> {
        return undefined;
    }

    public async resolvePortsFromContainer(_kubectl: Kubectl, _pod: string, _podNamespace: string | undefined, _container: string): Promise<PortInfo | undefined> {
        return undefined;
    }

    public filterSupportedProcesses(_processes: ProcessInfo[]): ProcessInfo[] | undefined {
        return undefined;
    }

    public isPortRequired(): boolean {
        return false;
    }

    public async getDebugArgs(): Promise<Cancellable> {
        return { cancelled: false };
    }
}
