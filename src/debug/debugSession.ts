import * as vscode from "vscode";
import * as fs from "fs";
import * as browser from "../components/platform/browser";
import * as path from "path";
import * as portfinder from "portfinder";
import { ChildProcess } from "child_process";

import { IDebugProvider, PortInfo } from "./debugProvider";
import { ProcessInfo, getProcesses } from "./debugUtils";
import * as providerRegistry from "./providerRegistry";

import { kubeChannel } from "../kubeChannel";
import { Kubectl } from "../kubectl";
import * as kubectlUtils from "../kubectlUtils";
import { shell } from "../shell";

import { DockerfileParser } from "../docker/dockerfileParser";
import * as dockerUtils from "../docker/dockerUtils";
import { Pod, KubernetesCollection, Container } from "../kuberesources.objectmodel";
import * as config from "../components/config/config";
import { Dictionary } from "../utils/dictionary";
import { definedOf } from "../utils/array";
import * as imageUtils from "../image/imageUtils";
import { ExecResult } from "../binutilplusplus";

const debugCommandDocumentationUrl = "https://github.com/Azure/vscode-kubernetes-tools/blob/master/debug-on-kubernetes.md";

interface ProxyResult {
    readonly proxyProcess: ChildProcess | undefined;
    readonly proxyDebugPort: number;
    readonly proxyAppPort: number;
}

export interface IDebugSession {
    launch(workspaceFolder: vscode.WorkspaceFolder, debugProvider?: IDebugProvider): Promise<void>;
    attach(workspaceFolder: vscode.WorkspaceFolder, pod?: string): Promise<void>;
}

export class DebugSession implements IDebugSession {
    private debugProvider: IDebugProvider | undefined;

    constructor(private readonly kubectl: Kubectl) {
    }

    /**
     * In launch mode, build the docker image from docker file first and then run it on kubernetes cluster,
     * after that smartly resolve the debugging info from the docker image and create port-forward,
     * finally start a debugger to attach to the debugging process.
     *
     * Besides, when the debug session is terminated, kill the port-forward and cleanup the created kubernetes resources (deployment/pod) automatically.
     *
     * @param workspaceFolder the active workspace folder.
     * @param debugProvider the debug provider. If not specified, prompt user to pick up a debug provider from the supported list.
     */
    public async launch(workspaceFolder: vscode.WorkspaceFolder, debugProvider?: IDebugProvider): Promise<void> {
        if (!workspaceFolder) {
            return;
        }
        // TODO: Support docker-compose.yml
        const dockerfilePath = path.join(workspaceFolder.uri.fsPath, "Dockerfile");
        if (!fs.existsSync(dockerfilePath)) {
            await this.openInBrowser(`No Dockerfile found in the workspace ${workspaceFolder.name}. See the documentation for how to use this command.`, debugCommandDocumentationUrl);
            return;
        }
        const dockerfile = new DockerfileParser().parse(dockerfilePath);
        if (debugProvider) {
            this.debugProvider = (await debugProvider.isDebuggerInstalled()) ? debugProvider : undefined;
        } else {
            this.debugProvider = await this.pickupAndInstallDebugProvider(dockerfile.getBaseImage());
        }
        if (!this.debugProvider) {
            return;
        }

        const cwd = workspaceFolder.uri.fsPath;
        const imagePrefix = vscode.workspace.getConfiguration().get<string | null>("vsdocker.imageUser", null);
        const containerEnv = Dictionary.of<string>();
        const portInfo = await this.debugProvider.resolvePortsFromFile(dockerfile, containerEnv);
        const debugArgs = await this.debugProvider.getDebugArgs();

        if (!imagePrefix) {
            await vscode.window.showErrorMessage("No Docker image prefix set for image push. Please set 'vsdocker.imageUser' in your Kubernetes extension settings.");
            return;
        }
        if (!portInfo || !portInfo.debugPort || !portInfo.appPort) {
            await this.openInBrowser("Cannot resolve debug/application port from Dockerfile. See the documentation for how to use this command.", debugCommandDocumentationUrl);
            return;
        }

        vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (p) => {
            let appName;
            try {
                // Build/push docker image.
                p.report({ message: "Building Docker image..."});
                const shellOpts = Object.assign({ }, shell.execOpts(), { cwd });
                const imageName = await this.buildDockerImage(imagePrefix, shellOpts);

                // Run docker image in k8s container.
                p.report({ message: "Running Docker image on Kubernetes..."});
                const exposedPorts = definedOf(portInfo.appPort, portInfo.debugPort);
                appName = await this.runAsDeployment(imageName, exposedPorts, containerEnv, debugArgs);

                // Find the running debug pod.
                p.report({ message: "Finding the debug pod..."});
                const podName = await this.findDebugPod(appName);

                // Wait for the debug pod status to be running.
                p.report({ message: "Waiting for the pod to be ready..."});
                await this.waitForPod(podName);

                // Setup port-forward.
                p.report({ message: "Setting up port forwarding..."});
                const proxyResult = await this.setupPortForward(podName, undefined, portInfo.debugPort, portInfo.appPort);

                if (!proxyResult.proxyProcess) {
                    return;  // No port forwarding, so can't debug
                }

                // Start debug session.
                p.report({ message: `Starting ${this.debugProvider!.getDebuggerType()} debug session...`});  // safe because checked outside the lambda
                await this.startDebugSession(appName, cwd, proxyResult, podName, undefined);
            } catch (error) {
                vscode.window.showErrorMessage(error);
                kubeChannel.showOutput(`Debug on Kubernetes failed. The errors were: ${error}.`);
                if (appName) {
                    await this.promptForCleanup(`deployment/${appName}`);
                }
                kubeChannel.showOutput(`\nTo learn more about the usage of the debug feature, take a look at ${debugCommandDocumentationUrl}`);
            }
        });
    }

    /**
     * In attach mode, the user should choose the running pod first, then the debugger will attach to it.
     *
     * @param workspaceFolder the active workspace folder.
     * @param pod the target pod name.
     */
    public async attach(workspaceFolder: vscode.WorkspaceFolder, pod?: string, podNamespace?: string): Promise<void> {
        if (!workspaceFolder) {
            return;
        }

        const targetPodInfo = await this.getPodTarget(pod, podNamespace);
        if (!targetPodInfo) {
            return;
        }

        const { targetPod, targetPodNS, containers } = targetPodInfo;

        // Select the target container to attach.
        // TODO: consolidate with container selection in extension.ts.
        const targetContainer = await this.pickContainer(containers);
        if (!targetContainer) {
            return;
        }

        const processes = await getProcesses(this.kubectl, targetPod, targetPodNS, targetContainer);

        // Select the image type to attach.
        this.debugProvider = await this.pickupAndInstallDebugProvider(undefined, processes);
        if (!this.debugProvider) {
            return;
        }

        const pidToDebug = this.tryFindTargetPid(processes);

        // Find the debug port to attach.
        const isPortRequired = this.debugProvider.isPortRequired();
        let portInfo: PortInfo | undefined = undefined;
        if (isPortRequired) {
            portInfo = await this.debugProvider.resolvePortsFromContainer(this.kubectl, targetPod, targetPodNS, targetContainer);
            if (!portInfo || !portInfo.debugPort) {
                await this.openInBrowser("Cannot resolve the debug port to attach. See the documentation for how to use this command.", debugCommandDocumentationUrl);
                return;
            }
        }

        vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (p) => {
            try {
                let proxyResult: ProxyResult | undefined;
                if (isPortRequired) {
                    p.report({ message: "Setting up port forwarding..."});
                    if (portInfo) {
                        proxyResult = await this.setupPortForward(targetPod, targetPodNS, portInfo.debugPort);
                    }

                    if (!proxyResult || !proxyResult.proxyProcess) {
                        return;  // No port forwarding, so can't debug
                    }
                }

                // Start debug session.
                p.report({ message: `Starting ${this.debugProvider!.getDebuggerType()} debug session...`});  // safe because checked outside lambda

                await this.startDebugSession(undefined, workspaceFolder.uri.fsPath, proxyResult, targetPod, pidToDebug);
            } catch (error) {
                vscode.window.showErrorMessage(error);
                kubeChannel.showOutput(`Debug on Kubernetes failed. The errors were: ${error}.`);
                kubeChannel.showOutput(`\nTo learn more about the usage of the debug feature, take a look at ${debugCommandDocumentationUrl}`);
            }
        });
    }

    tryFindTargetPid(processes: ProcessInfo[] | undefined): number | undefined {
        const supportedProcesses = processes ? (<IDebugProvider>this.debugProvider).filterSupportedProcesses(processes) : undefined;
        return supportedProcesses && supportedProcesses.length === 1 ? +supportedProcesses[0].pid : undefined;
    }

    async getPodTarget(pod?: string, podNamespace?: string) {
        // Select the target pod to attach.
        let targetPod = pod,
            targetPodNS = podNamespace,
            containers: Container[] = [];

        if (targetPod) {
            const resource = await kubectlUtils.getResourceAsJson<Pod>(this.kubectl, `pod/${pod}`, podNamespace);
            if (!resource) {
                return undefined;
            }

            containers = resource.spec.containers;

            return { targetPod, targetPodNS, containers };
        }

        const resource =  await kubectlUtils.getResourceAsJson<KubernetesCollection<Pod>>(this.kubectl, "pods");
        if (!resource) {
            return;
        }

        const podPickItems = resource.items.map((pod) => {
            return {
                label: `${pod.metadata.name} (${pod.spec.nodeName})`,
                description: "pod",
                name: pod.metadata.name,
                namespace: pod.metadata.namespace,
                containers: pod.spec.containers
            };
        });

        const selectedPod = await vscode.window.showQuickPick(podPickItems, { placeHolder: `Please select a pod to attach` });
        if (!selectedPod) {
            return;
        }

        targetPod = selectedPod.name;
        targetPodNS = selectedPod.namespace;
        containers = selectedPod.containers;
        return { targetPod, targetPodNS, containers };
    }

    async pickContainer(containers: Container[]): Promise<string | undefined> {
        if (containers.length === 0) {
            return undefined;
        }
        if (containers.length === 1) {
            return containers[0].name;
        }

        const containerPickItems = containers.map((container) => {
            return {
                label: container.name,
                description: '',
                detail: container.image,
                name: container.name
            };
        });

        const selectedContainer = await vscode.window.showQuickPick(containerPickItems, { placeHolder: "Please select a container to attach" });
        if (!selectedContainer) {
            return undefined;
        }

        return selectedContainer.name;
    }

    private async pickupAndInstallDebugProvider(baseImage?: string, runningProcesses?: ProcessInfo[]): Promise<IDebugProvider | undefined> {
        const debugProvider = await providerRegistry.getDebugProvider(baseImage, runningProcesses);
        if (!debugProvider) {
            return undefined;
        } else if (!await debugProvider.isDebuggerInstalled()) {
            return undefined;
        }

        return debugProvider;
    }

    private async buildDockerImage(imagePrefix: string, shellOpts: any): Promise<string> {
        kubeChannel.showOutput("Starting to build/push Docker image...", "Docker build/push");
        if (!imagePrefix) {
            // In order to allow local kubernetes cluster (e.g. minikube) to have access to local docker images,
            // need override docker-env before running docker build.
            const dockerEnv = await dockerUtils.resolveKubernetesDockerEnv(this.kubectl);
            shellOpts.env = Object.assign({}, shellOpts.env, dockerEnv);
        }
        const imageName = await imageUtils.buildAndPushImage(shellOpts, imagePrefix);
        kubeChannel.showOutput(`Finished building/pushing Docker image ${imageName}.`);

        return imageName;
    }

    private async runAsDeployment(image: string, exposedPorts: number[], containerEnv: any, debugArgs?: string): Promise<string> {
        kubeChannel.showOutput(`Starting to run image ${image} on Kubernetes cluster...`, "Run on Kubernetes");
        const imageName = image.split(":")[0];
        const baseName = imageName.substring(imageName.lastIndexOf("/")+1);
        const deploymentName = `${baseName}-debug-${Date.now()}`;
        const appName = await kubectlUtils.runAsDeployment(this.kubectl, deploymentName, image, exposedPorts, containerEnv, debugArgs);
        kubeChannel.showOutput(`Finished launching image ${image} as a deployment ${appName} on Kubernetes cluster.`);
        return appName;
    }

    private async findDebugPod(appName: string): Promise<string> {
        kubeChannel.showOutput(`Searching for pods with label run=${appName}`, "Find debug pod");
        const podList = await kubectlUtils.findPodsByLabel(this.kubectl, `run=${appName}`);
        if (podList.items.length === 0) {
            throw new Error("Failed to find debug pod.");
        }
        const podName = podList.items[0].metadata.name;
        kubeChannel.showOutput(`Found the running debug pod: ${podName}`);
        return podName;
    }

    private async waitForPod(podName: string): Promise<void> {
        kubeChannel.showOutput(`Waiting for pod ${podName} status to become Running...`, "Wait for pod");
        await kubectlUtils.waitForRunningPod(this.kubectl, podName);
        kubeChannel.showOutput(`Finshed waiting.`);
    }

    private async setupPortForward(podName: string, podNamespace: string | undefined, debugPort: number, appPort?: number): Promise<ProxyResult> {
        kubeChannel.showOutput(`Setting up port forwarding on pod ${podName}...`, "Set up port forwarding");
        const proxyResult = await this.createPortForward(this.kubectl, podName, podNamespace, debugPort, appPort);

        if (!proxyResult.proxyProcess) {
            kubeChannel.showOutput("Unable to launch kubectl for port forwarding");
            return proxyResult;
        }

        const appPortStr = appPort ? `${proxyResult.proxyAppPort}:${appPort}` : "";
        kubeChannel.showOutput(`Created port-forward ${proxyResult.proxyDebugPort}:${debugPort} ${appPortStr}`);

        // Wait for the port-forward proxy to be ready.
        kubeChannel.showOutput("Waiting for port forwarding to be ready...");
        await this.waitForProxyReady(proxyResult.proxyProcess);
        kubeChannel.showOutput("Port forwarding is ready.");

        return proxyResult;
    }

    private async startDebugSession(appName: string | undefined, cwd: string, proxyResult: ProxyResult | undefined, pod: string, pidToDebug: number | undefined): Promise<void> {
        kubeChannel.showOutput("Starting debug session...", "Start debug session");
        const sessionName = appName || `${Date.now()}`;

        const proxyDebugPort = proxyResult ? proxyResult.proxyDebugPort : undefined;
        const proxyAppPort = proxyResult ? proxyResult.proxyAppPort : undefined;

        await this.startDebugging(cwd, sessionName, proxyDebugPort, proxyAppPort, pod, pidToDebug, async () => {
            if (proxyResult && proxyResult.proxyProcess) {
                proxyResult.proxyProcess.kill();
            }
            if (appName) {
                kubeChannel.showOutput("The debug session exited.");
                await this.promptForCleanup(`deployment/${appName}`);
            }
        });
    }

    private async promptForCleanup(resourceId: string): Promise<void> {
        const autoCleanupFlag = config.getAutoCompleteOnDebugTerminate();
        if (autoCleanupFlag) {
            return await this.cleanupResource(resourceId);
        }
        const answer = await vscode.window.showWarningMessage(`Resource ${resourceId} will continue running on the cluster.`, "Clean Up", "Always Clean Up");
        if (answer === "Clean Up") {
            return await this.cleanupResource(resourceId);
        } else if (answer === "Always Clean Up") {
            await config.setAlwaysCleanUp();
            return await this.cleanupResource(resourceId);
        }
    }

    private async cleanupResource(resourceId: string): Promise<void> {
        kubeChannel.showOutput(`Starting to clean up debug resource...`, "Cleanup debug resource");
        const deleteResult = await this.kubectl.invokeCommand(`delete ${resourceId}`);
        if (ExecResult.failed(deleteResult)) {
            kubeChannel.showOutput(ExecResult.failureMessage(deleteResult, {}));
            return;
        } else {
            kubeChannel.showOutput(`Resource ${resourceId} is removed successfully.`);
            vscode.commands.executeCommand("extension.vsKubernetesRefreshExplorer");
        }
    }

    private async createPortForward(kubectl: Kubectl, podName: string, podNamespace: string | undefined, debugPort: number, appPort?: number): Promise<ProxyResult> {
        const portMapping = [];
        // Find a free local port for forwarding data to remote app port.
        let proxyAppPort = 0;
        if (appPort) {
            proxyAppPort = await portfinder.getPortPromise({
                port: appPort
            });
            portMapping.push(`${proxyAppPort}:${appPort}`);
        }
        // Find a free local port for forwarding data to remote debug port.
        const proxyDebugPort = await portfinder.getPortPromise({
            port: Math.max(10000, Number(proxyAppPort) + 1)
        });
        portMapping.push(`${proxyDebugPort}:${debugPort}`);

        const nsarg = podNamespace ? [ '--namespace', podNamespace ] : [];

        const proxyProcess = await kubectl.spawnCommand(["port-forward", podName, ...nsarg, ...portMapping]);

        if (proxyProcess.resultKind === 'exec-bin-not-found') {
            kubectl.reportFailure(proxyProcess, { whatFailed: 'Failed to forward debug port' });
            return {
                proxyProcess: undefined,
                proxyDebugPort,
                proxyAppPort
            };
        }

        return {
            proxyProcess: proxyProcess.childProcess,
            proxyDebugPort,
            proxyAppPort
        };
    }

    private async waitForProxyReady(proxyProcess: ChildProcess): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let isProxyReady = false;

            proxyProcess.stdout.on('data', async (data) => {
                const message = `${data}`;
                if (!isProxyReady && this.isForwardingCompleteMessage(message)) {
                    isProxyReady = true;
                    resolve();
                }
            });

            proxyProcess.stderr.on('data', (data) => {
                kubeChannel.showOutput(`${data}`, "port-forward");
            });

            proxyProcess.on('close', async (_code) => {
                if (!isProxyReady) {
                    reject("Cannot setup port-forward.");
                    return;
                }
            });
        });
    }

    private isForwardingCompleteMessage(message: string): boolean {
        const forwardingRegExp = /Forwarding\s+from\s+127\.0\.0\.1:/;
        return forwardingRegExp.test(message);
    }

    private async startDebugging(workspaceFolder: string, sessionName: string, proxyDebugPort: number | undefined, proxyAppPort: number | undefined, pod: string, pidToDebug: number | undefined, onTerminateCallback: () => Promise<any>): Promise<boolean> {
        const disposables: vscode.Disposable[] = [];
        disposables.push(vscode.debug.onDidStartDebugSession((debugSession) => {
            if (debugSession.name === sessionName) {
                kubeChannel.showOutput("The debug session has started. Your application is ready for you to debug.");
                if (proxyAppPort) {
                    kubeChannel.showOutput(`You can access your application via localhost port ${proxyAppPort}.`);
                }
            }
        }));

        disposables.push(vscode.debug.onDidTerminateDebugSession(async (debugSession) => {
            if (debugSession.name === sessionName) {
                disposables.forEach((d) => d.dispose());
                await onTerminateCallback();
            }
        }));

        if (!this.debugProvider) {
            console.warn("INTERNAL ERROR: DebugSession.debugProvider was expected to be assigned before starting debugging");
            return false;
        }

        const success = await this.debugProvider.startDebugging(workspaceFolder, sessionName, proxyDebugPort, pod, pidToDebug);
        if (!success) {
            disposables.forEach((d) => d.dispose());
            await onTerminateCallback();
        }
        return success;
    }

    private async openInBrowser(errorMessage: string, link: string): Promise<void> {
        const answer = await vscode.window.showErrorMessage(errorMessage, "Open in Browser");
        if (answer === "Open in Browser") {
            browser.open(link);
        }
    }
}
