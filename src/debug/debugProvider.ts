import { Kubectl } from "../kubectl";
import { IDockerfile } from "../docker/parser";
import { Dictionary } from "../utils/dictionary";
import { ProcessInfo } from "./debugUtils";

export interface PortInfo {
    readonly debugPort: number;
    readonly appPort?: number;
}

interface Accepted {
    readonly cancelled: false;
    readonly value?: string;
}

interface Cancelled {
    readonly cancelled: true;
}

export type Cancellable = Accepted | Cancelled;

export interface IDebugProvider {
    /**
     * The debugger type supported by the provider.
     */
    getDebuggerType(): string;

    /**
     * The required debugger extension is installed or not.
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
    startDebugging(workspaceFolder: string, sessionName: string, port: number | undefined, pod: string, pidToDebug: number | undefined): Promise<boolean>;

    /**
     * The docker image is supported by the provider or not.
     *
     * @param baseImage the inherited image name.
     * @return true if the provider can infer the application type from the image name, otherwise, false.
     */
    isSupportedImage(baseImage: string): boolean;

    /**
     * Resolve the debug port info from the dockerfile.
     *
     * @param dockerfile the docker file.
     * @param env the environment variables defined by the docker file.
     * @return the resolved debug port info.
     */
    resolvePortsFromFile(dockerfile: IDockerfile, env: Dictionary<string>): Promise<PortInfo | undefined>;

    /**
     * Resolve the debug port info from the container's shell environment.
     *
     * @param kubectl the kubectl client.
     * @param pod the pod id.
     * @param container the container id.
     * @return the resolved port info.
     */
    resolvePortsFromContainer(kubectl: Kubectl, pod: string, podNamespace: string | undefined, container: string): Promise<PortInfo | undefined>;

    /**
     * Filters the process list to those processes that can be debugged by the the provider.
     *
     * @param processes the running processes on the container
     * @return the list of processes supported by the provider
     */
    filterSupportedProcesses(processes: ProcessInfo[]): ProcessInfo[] | undefined;

    /**
     * Returns true if the debugger requires a port to connect to.
     */
    isPortRequired(): boolean;

    /**
     * The additional args required by the debugger
     */
    getDebugArgs(): Promise<Cancellable>;
}
