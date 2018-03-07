import * as path from "path";
import * as vscode from "vscode";

import { IDebugProvider, PortInfo } from "./debugProvider";
import * as debugUtils from "./debugUtils";
import * as extensionUtils from "../extensionUtils";
import { Kubectl } from "../kubectl";
import { IDockerfile } from "../docker/parser";

// Use VSCode built-in Node Debugger to debug Node.js application.
const defaultNodeDebuggerConfigType = "node";

const defaultDebugPort = "9229";
const defaultAppPort = "9000";
const nodeDebugOptsRegExp = /(--)?(debug|inspect)(=\S*)?/;
const fullNodeDebugOptsRegExp = /node(js)?\s+.*(--)?(debug|inspect)(=\S*)?/i;

export class NodeDebugProvider implements IDebugProvider {
    public getDebuggerType(): string {
        return defaultNodeDebuggerConfigType;
    }

    // Use VSCode built-in Node Debugger to debug Node.js application.
    public async isDebuggerInstalled(): Promise<boolean> {
        return true;
    }

    public async startDebugging(workspaceFolder: string, sessionName: string, port: number): Promise<boolean> {
        const debugConfiguration = {
            type: 'node',
            request: 'attach',
            name: sessionName,
            port,
            localRoot: workspaceFolder,
            remoteRoot: '/'
        };
        const currentFolder = vscode.workspace.workspaceFolders.find((folder) => folder.name === path.basename(workspaceFolder));
        return await vscode.debug.startDebugging(currentFolder, debugConfiguration);
    }

    public isSupportedImage(baseImage: string): boolean {
        return baseImage.indexOf("node") >= 0;
    }

    public async resolvePortsFromFile(dockerfile: IDockerfile, env: {}): Promise<PortInfo | undefined> {
        let rawDebugPortInfo: string;
        let rawAppPortInfo: string;

        // Resolve the debug port.
        const nodeCmd = dockerfile.searchLaunchArgs(nodeDebugOptsRegExp);
        if (extensionUtils.isNonEmptyArray(nodeCmd)) {
            if (nodeCmd[3]) { // node --inspect=9229
                const addresses = nodeCmd[3].substring(1).split(":");
                rawDebugPortInfo = addresses[addresses.length - 1];
            } else { // node --inspect
                rawDebugPortInfo = (nodeCmd[2] === "inspect" ? "9229" : "5858");
            }
        }
        // Cannot resolve the debug port from Dockerfile, then ask user to specify it.
        if (!rawDebugPortInfo) {
            rawDebugPortInfo = await debugUtils.promptForDebugPort(defaultDebugPort);
        }
        if (!rawDebugPortInfo) {
            return;
        }

        // Resolve the app port.
        const exposedPorts = dockerfile.getExposedPorts();
        if (exposedPorts.length) {
            const excludes = [ "9229", "5858", rawDebugPortInfo ];
            const possiblePorts = exposedPorts.filter((port) => excludes.indexOf(port) === -1);
            rawAppPortInfo = await debugUtils.promptForAppPort(possiblePorts, defaultAppPort, env);
        }

        return {
            debugPort: Number(rawDebugPortInfo),
            appPort: Number(rawAppPortInfo)
        };
    }

    public async resolvePortsFromContainer(kubectl: Kubectl, pod: string, container: string): Promise<PortInfo> {
        let rawDebugPortInfo: string;

        const commandLines = await debugUtils.getCommandsOfProcesses(kubectl, pod, container);
        for (const commandLine of commandLines) {
            // node --inspect=9229 index.js
            const matches = commandLine.match(fullNodeDebugOptsRegExp);
            if (extensionUtils.isNonEmptyArray(matches)) {
                if (matches[4]) { // node --inspect=9229
                    const addresses = matches[4].substring(1).split(":");
                    rawDebugPortInfo = addresses[addresses.length - 1];
                } else { // node --inspect
                    rawDebugPortInfo = (matches[3] === "inspect" ? "9229" : "5858");
                }
                break;
            }
        }

        if (!rawDebugPortInfo) {
            rawDebugPortInfo = await debugUtils.promptForDebugPort(defaultDebugPort);
        }

        return {
            debugPort: Number(rawDebugPortInfo)
        };
    }
}
