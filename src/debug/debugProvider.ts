import * as vscode from "vscode";

import { Kubectl } from "../kubectl";
import { ShellResult } from "../shell";
import { IDockerParser } from "../docker/parser";

export interface PortInfo {
    debugPort: number;
    appPort: number;
}

export interface IDebugProvider {
    /**
     * The debugger type supported by the provider.
     * 
     */
    getDebuggerType(): string;

    /**
     * The required debugger extension is installed or not.
     * 
     */
    isDebuggerInstalled(): Promise<boolean>;

    /**
     * Launch the debugger extension and attach to the target debug port.
     * 
     * @param workspaceFolder the workspace folder path.
     * @param sessionName the debug session name.
     * @param port the debugging port exposed by the target program.
     * @return A thenable that resolves when debugging could be successfully started.
     */
    startDebugging(workspaceFolder: string, sessionName: string, port: number): Promise<boolean>;

        /**
     * The docker image is supported by the provider or not.
     * 
     */
    isSupportedImage(baseImage: string): boolean;

    /**
     * Resolve the debug port info from the dockerfile.
     */
    resolvePortsFromFile(dockerParser: IDockerParser, env: {}): Promise<PortInfo>;

    /**
     * Resolve the debug port info from the container's shell environment.
     */
    resolvePortsFromContainer(kubectl: Kubectl, pod: string, container: string): Promise<PortInfo>;
}
