import * as path from "path";
import * as vscode from 'vscode';

import { IDebugProvider, IDockerParser, IDockerResolver, PortInfo } from './debugInterfaces';
import * as debugUtils from "./debugUtils";
import { shell } from '../shell';

// Use the java debugger extension provided by microsoft team for java debugging.
const defaultJavaDebuggerExtension = "vscjava.vscode-java-debug";

export class JavaDebugProvider implements IDebugProvider {
    constructor(readonly dockerResolver: IDockerResolver) {
    }

    public getDebuggerType(): string {
        return "java";
    }

    public async isDebuggerInstalled(): Promise<boolean> {
        if (vscode.extensions.getExtension(defaultJavaDebuggerExtension)) {
            return true;
        }
        const answer = await vscode.window.showInformationMessage(`Please install java debugger extension '${defaultJavaDebuggerExtension}' before debugging.`, "Install Now");
        if (answer === "Install Now") {
            return await debugUtils.installVscodeExtension(defaultJavaDebuggerExtension);
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

    public getDockerResolver(): IDockerResolver {
        return this.dockerResolver;
    }
}
