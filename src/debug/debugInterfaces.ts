import * as vscode from "vscode";

import { Kubectl } from '../kubectl';
import { ShellResult } from "../shell";

export interface PortInfo {
    debug: string;
    app: string;
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
    startDebugging(workspaceFolder: string, sessionName: string, port: string): Promise<boolean>;

    /**
     * Get the associated docker resolver for the provider.
     */
    getDockerResolver(): IDockerResolver;
}

export interface IDockerResolver {
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

export interface IDockerParser {
    /**
     * Parse the inherited base image from the dockerfile.
     */
    getBaseImage(): string;

    /**
     *  Parse the exposed ports from the dockerfile.
     */
    getExposedPorts(): string[];

    /**
     * Search the debug options from the launch command.
     */
    searchLaunchArgs(regularExpression: RegExp): RegExpMatchArray;
}
