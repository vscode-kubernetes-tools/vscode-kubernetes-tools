import * as vscode from "vscode";
import * as fs from "fs";
import * as opn from 'opn';
import * as path from "path";
import * as portfinder from "portfinder";
import { ChildProcess } from "child_process";

import { IDebugProvider } from "./debugProvider";
import * as providerRegistry from "./providerRegistry";

import { kubeChannel } from "../kubeChannel";
import { Kubectl } from "../kubectl";
import * as kubectlUtils from "../kubectlUtils";
import { shell } from "../shell";

import { DockerfileParser } from "../docker/dockerfileParser";
import * as dockerUtils from "../docker/dockerUtils";
import { isPod, Pod, KubernetesCollection, Container } from "../kuberesources.objectmodel";
import * as config from "../components/config/config";
import { Dictionary } from "../utils/dictionary";

const debugCommandDocumentationUrl = "https://github.com/Azure/vscode-kubernetes-tools/blob/master/debug-on-kubernetes.md";

interface ProxyResult {
    readonly proxyProcess: ChildProcess;
    readonly proxyDebugPort: number;
    readonly proxyAppPort: number;
}

export interface IDebugSession {
    launch(workspaceFolder: vscode.WorkspaceFolder, debugProvider?: IDebugProvider): Promise<void>;
    attach(workspaceFolder: vscode.WorkspaceFolder, pod?: string): Promise<void>;
}

export class DebugSession implements IDebugSession {
    private debugProvider: IDebugProvider;

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
            this.debugProvider = (await debugProvider.isDebuggerInstalled())? debugProvider : null;
        } else {
            this.debugProvider = await this.pickupAndInstallDebugProvider(dockerfile.getBaseImage());
        }
        if (!this.debugProvider) {
            return;
        }

        const cwd = workspaceFolder.uri.fsPath;
        const imagePrefix = vscode.workspace.getConfiguration().get("vsdocker.imageUser", null);
        const containerEnv = Dictionary.of<string>();
        const portInfo = await this.debugProvider.resolvePortsFromFile(dockerfile, containerEnv);
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
                appName = await this.runAsDeployment(imageName, [portInfo.appPort, portInfo.debugPort], containerEnv);

                // Find the running debug pod.
                p.report({ message: "Finding the debug pod..."});
                const podName = await this.findDebugPod(appName);

                // Wait for the debug pod status to be running.
                p.report({ message: "Waiting for the pod to be ready..."});
                await this.waitForPod(podName);

                // Setup port-forward.
                p.report({ message: "Setting up port forwarding..."});
                const proxyResult = await this.setupPortForward(podName, undefined, portInfo.debugPort, portInfo.appPort);

                // Start debug session.
                p.report({ message: `Starting ${this.debugProvider.getDebuggerType()} debug session...`});
                await this.startDebugSession(appName, cwd, proxyResult);
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

        // Select the image type to attach.
        this.debugProvider = await this.pickupAndInstallDebugProvider();
        if (!this.debugProvider) {
            return;
        }

        // Select the target pod to attach.
        let targetPod = pod,
            targetPodNS = podNamespace,
            targetContainer: string | undefined = undefined,
            containers: Container[] = [];

        const resource = pod ?
                            await kubectlUtils.getResourceAsJson<Pod>(this.kubectl, `pod/${pod}`, podNamespace) :
                            await kubectlUtils.getResourceAsJson<KubernetesCollection<Pod>>(this.kubectl, "pods");
        if (!resource) {
            return;
        }

        if (isPod(resource)) {
            containers = resource.spec.containers;
        } else {
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
        }

        // Select the target container to attach.
        // TODO: consolidate with container selection in extension.ts.
        if (containers.length > 1) {
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
                return;
            }

            targetContainer = selectedContainer.name;
        }

        // Find the debug port to attach.
        const portInfo = await this.debugProvider.resolvePortsFromContainer(this.kubectl, targetPod, targetPodNS, targetContainer);
        if (!portInfo || !portInfo.debugPort) {
            await this.openInBrowser("Cannot resolve the debug port to attach. See the documentation for how to use this command.", debugCommandDocumentationUrl);
            return;
        }

        vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (p) => {
            try {
                // Setup port-forward.
                p.report({ message: "Setting up port forwarding..."});
                const proxyResult = await this.setupPortForward(targetPod, targetPodNS, portInfo.debugPort);

                // Start debug session.
                p.report({ message: `Starting ${this.debugProvider.getDebuggerType()} debug session...`});
                await this.startDebugSession(null, workspaceFolder.uri.fsPath, proxyResult);
            } catch (error) {
                vscode.window.showErrorMessage(error);
                kubeChannel.showOutput(`Debug on Kubernetes failed. The errors were: ${error}.`);
                kubeChannel.showOutput(`\nTo learn more about the usage of the debug feature, take a look at ${debugCommandDocumentationUrl}`);
            }
        });
    }

    private async pickupAndInstallDebugProvider(baseImage?: string): Promise<IDebugProvider | undefined> {
        const debugProvider: IDebugProvider = await providerRegistry.getDebugProvider();
        if (!debugProvider) {
            return;
        } else if (!await debugProvider.isDebuggerInstalled()) {
            return;
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
        const imageName = await dockerUtils.buildAndPushDockerImage(dockerUtils.DockerClient.docker, shellOpts, imagePrefix);
        kubeChannel.showOutput(`Finished building/pushing Docker image ${imageName}.`);

        return imageName;
    }

    private async runAsDeployment(image: string, exposedPorts: number[], containerEnv: any): Promise<string> {
        kubeChannel.showOutput(`Starting to run image ${image} on Kubernetes cluster...`, "Run on Kubernetes");
        const imageName = image.split(":")[0];
        const baseName = imageName.substring(imageName.lastIndexOf("/")+1);
        const deploymentName = `${baseName}-debug-${Date.now()}`;
        const appName = await kubectlUtils.runAsDeployment(this.kubectl, deploymentName, image, exposedPorts, containerEnv);
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
        const appPortStr = appPort ? `${proxyResult.proxyAppPort}:${appPort}` : "";
        kubeChannel.showOutput(`Created port-forward ${proxyResult.proxyDebugPort}:${debugPort} ${appPortStr}`);

        // Wait for the port-forward proxy to be ready.
        kubeChannel.showOutput("Waiting for port forwarding to be ready...");
        await this.waitForProxyReady(proxyResult.proxyProcess);
        kubeChannel.showOutput("Port forwarding is ready.");

        return proxyResult;
    }

    private async startDebugSession(appName: string, cwd: string, proxyResult: ProxyResult): Promise<void> {
        kubeChannel.showOutput("Starting debug session...", "Start debug session");
        const sessionName = appName || `${Date.now()}`;
        await this.startDebugging(cwd, sessionName, proxyResult.proxyDebugPort, proxyResult.proxyAppPort, async () => {
            proxyResult.proxyProcess.kill();
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
        const deleteResult = await this.kubectl.invokeAsync(`delete ${resourceId}`);
        if (deleteResult.code !== 0) {
            kubeChannel.showOutput(`Kubectl command failed: ${deleteResult.stderr}`);
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

        return {
            proxyProcess: await kubectl.spawnAsChild(["port-forward", podName, ...nsarg, ...portMapping]),
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

            proxyProcess.on('close', async (code) => {
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

    private async startDebugging(workspaceFolder: string, sessionName: string, proxyDebugPort: number, proxyAppPort: number, onTerminateCallback: () => Promise<any>): Promise<boolean> {
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

        const success = await this.debugProvider.startDebugging(workspaceFolder, sessionName, proxyDebugPort);
        if (!success) {
            disposables.forEach((d) => d.dispose());
            await onTerminateCallback();
        }
        return success;
    }

    private async openInBrowser(errorMessage: string, link: string): Promise<void> {
        const answer = await vscode.window.showErrorMessage(errorMessage, "Open in Browser");
        if (answer === "Open in Browser") {
            opn(link);
        }
    }
}
