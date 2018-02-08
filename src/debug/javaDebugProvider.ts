import * as path from "path";
import * as vscode from 'vscode';

import { IDebugProvider, PortInfo } from './debugProvider';
import * as extensionUtils from "../extensionUtils";
import { Kubectl } from '../kubectl';
import { IDockerParser } from "../docker/parser";

// Use the java debugger extension provided by microsoft team for java debugging.
const defaultJavaDebuggerExtensionId = "vscjava.vscode-java-debug";
const defaultJavaDebuggerExtension = "Debugger for Java";
const defaultJavaDebuggerConfigType = "java";

const defaultJavaDebugPort = "5005";
const defaultJavaAppPort = "9000";
const defaultJavaDebugOpts = `-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=${defaultJavaDebugPort},quiet=y`;
const javaDebugOptsRegExp = /(-agentlib|-Xrunjdwp):\S*(address=[^\s,]+)/i;
const fullJavaDebugOptsRegExp = /^java\s+.*(-agentlib|-Xrunjdwp):\S*(address=[^\s,]+)\S*/i;

export class JavaDebugProvider implements IDebugProvider {
    public getDebuggerType(): string {
        return defaultJavaDebuggerConfigType;
    }

    public async isDebuggerInstalled(): Promise<boolean> {
        if (vscode.extensions.getExtension(defaultJavaDebuggerExtensionId)) {
            return true;
        }
        const answer = await vscode.window.showInformationMessage(`Java debugging requires the '${defaultJavaDebuggerExtension}' extension. Would you like to install it now?`, "Install Now");
        if (answer === "Install Now") {
            return await extensionUtils.installVscodeExtension(defaultJavaDebuggerExtensionId);
        }
        return false;
    }

    public async startDebugging(workspaceFolder: string, sessionName: string, port: number): Promise<boolean> {
        const debugConfiguration = {
            type: "java",
            request: "attach",
            name: sessionName,
            hostName: "localhost",
            port
        };
        const currentFolder = vscode.workspace.workspaceFolders.find((folder) => folder.name === path.basename(workspaceFolder));
        return await vscode.debug.startDebugging(currentFolder, debugConfiguration);
    }

    public isSupportedImage(baseImage: string): boolean {
        return baseImage.indexOf("java") >= 0
            || baseImage.indexOf("openjdk") >= 0
            || baseImage.indexOf("oracle") >= 0;
    }

    public async resolvePortsFromFile(dockerParser: IDockerParser, env: {}): Promise<PortInfo | undefined> {
        const portInfo: PortInfo = {
            debugPort: null,
            appPort: null
        };

        // Resolve the debug port.
        const matches = dockerParser.searchLaunchArgs(javaDebugOptsRegExp);
        if (matches) {
            const addresses = matches[2].split("=")[1].split(":");
            portInfo.debugPort = addresses[addresses.length - 1];
        } else if (dockerParser.searchLaunchArgs(/\$\{?JAVA_OPTS\}?/)) {
            env["JAVA_OPTS"] = defaultJavaDebugOpts;
            portInfo.debugPort = defaultJavaDebugPort;
        }
        // Cannot resolve the debug port from Dockerfile, then ask user to specify it.
        if (!portInfo.debugPort) {
            const input = await vscode.window.showInputBox({
                prompt: `Please specify debug port exposed by the Dockerfile (e.g. 5005)`,
                placeHolder: "5005"
            });
            portInfo.debugPort = (input ? input.trim() : null);
        }
        if (!portInfo.debugPort) {
            return;
        }
        
        // Resolve the app port.
        const dockerExpose = dockerParser.getExposedPorts();
        if (dockerExpose.length) {
            const possiblePorts = dockerExpose.filter((port) => port !== portInfo.debugPort);
            if (possiblePorts.length === 1) {
                portInfo.appPort = possiblePorts[0];
            } else if (possiblePorts.length > 1) {
                portInfo.appPort = await vscode.window.showQuickPick(possiblePorts, { placeHolder: "Choose the application port you want to expose for debugging." });
            }
            // If the exposed port is a variable, then need set it in environment variables.
            if (/\$\{?(\w+)\}?/.test(portInfo.appPort)) {
                const varName = portInfo.appPort.match(/\$\{?(\w+)\}?/)[1];
                env[varName] = defaultJavaAppPort;
                portInfo.appPort = defaultJavaAppPort;
            }
        }

        return portInfo;
    }

    public async resolvePortsFromContainer(kubectl: Kubectl, pod: string, container: string): Promise<PortInfo> {
        //TODO
        return null;
    }
}
