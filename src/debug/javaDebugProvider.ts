import * as path from "path";
import * as vscode from 'vscode';

import { IDebugProvider, PortInfo } from './debugProvider';
import * as extensionUtils from "../extensionUtils";
import { Kubectl } from '../kubectl';
import { IDockerfile } from "../docker/parser";

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
        if (!baseImage) {
            return false;
        }
        return baseImage.indexOf("java") >= 0
            || baseImage.indexOf("openjdk") >= 0
            || baseImage.indexOf("oracle") >= 0;
    }

    public async resolvePortsFromFile(dockerfile: IDockerfile, env: {}): Promise<PortInfo | undefined> {
        let rawDebugPortInfo: string;
        let rawAppPortInfo: string;

        // Resolve the debug port.
        const matches = dockerfile.searchLaunchArgs(javaDebugOptsRegExp);
        if (matches) {
            const addresses = matches[2].split("=")[1].split(":");
            rawDebugPortInfo = addresses[addresses.length - 1];
        } else if (dockerfile.searchLaunchArgs(/\$\{?JAVA_OPTS\}?/)) {
            env["JAVA_OPTS"] = defaultJavaDebugOpts;
            rawDebugPortInfo = defaultJavaDebugPort;
        }
        // Cannot resolve the debug port from Dockerfile, then ask user to specify it.
        if (!rawDebugPortInfo) {
            const input = await vscode.window.showInputBox({
                prompt: `Please specify debug port exposed for debugging (e.g. 5005)`,
                placeHolder: "5005"
            });
            rawDebugPortInfo = (input ? input.trim() : null);
        }
        if (!rawDebugPortInfo) {
            return;
        }
        
        // Resolve the app port.
        const exposedPorts = dockerfile.getExposedPorts();
        if (exposedPorts.length) {
            const possiblePorts = exposedPorts.filter((port) => port !== rawDebugPortInfo);
            if (possiblePorts.length === 1) {
                rawAppPortInfo = possiblePorts[0];
            } else if (possiblePorts.length > 1) {
                rawAppPortInfo = await vscode.window.showQuickPick(possiblePorts, { placeHolder: "Choose the application port you want to expose for debugging." });
            }
            // If the exposed port is a variable, then need set it in environment variables.
            const portRegExp = /\$\{?(\w+)\}?/;
            if (portRegExp.test(rawAppPortInfo)) {
                const varName = rawAppPortInfo.match(portRegExp)[1];
                if (rawAppPortInfo.trim() === `$${varName}` || rawAppPortInfo.trim() === `\${${varName}}`) {
                    env[varName] = defaultJavaAppPort;
                    rawAppPortInfo = defaultJavaAppPort;
                } else {
                    vscode.window.showErrorMessage(`Invalid port variable ${rawAppPortInfo} in the docker file.`);
                    return;
                }
            }
        }

        return {
            debugPort: Number(rawDebugPortInfo),
            appPort: Number(rawAppPortInfo)
        };
    }

    public async resolvePortsFromContainer(kubectl: Kubectl, pod: string, container: string): Promise<PortInfo> {
        //TODO
        return null;
    }
}
