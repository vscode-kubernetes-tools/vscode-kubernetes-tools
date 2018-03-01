import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as portfinder from "portfinder";
import { ChildProcess, spawn as spawnChildProcess } from "child_process";

import { IDebugProvider } from "./debugProvider";
import * as providerRegistry from "./providerRegistry";

import { kubeChannel } from "../kubeChannel";
import { Kubectl } from "../kubectl";
import * as kubectlUtils from "../kubectlUtils";
import { shell } from "../shell";

import { DockerfileParser } from "../docker/dockerfileParser";
import * as dockerUtils from "../docker/dockerUtils";

interface ProxyResult {
    readonly proxyProcess: ChildProcess;
    readonly proxyDebugPort: number;
    readonly proxyAppPort: number;
}

export interface IDebugSession {
    launch(workspaceFolder: vscode.WorkspaceFolder): Promise<void>;
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
     */
    public async launch(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
        if (!workspaceFolder) {
            return;
        }
        // TODO: Support docker-compose.yml
        const dockerfilePath = path.join(workspaceFolder.uri.fsPath, "Dockerfile");
        if (!fs.existsSync(dockerfilePath)) {
            vscode.window.showErrorMessage(`No Dockerfile found in the workspace ${workspaceFolder.name}`);
            return;
        }
        const dockerfile = new DockerfileParser().parse(dockerfilePath);
        this.debugProvider = await providerRegistry.getDebugProvider(dockerfile.getBaseImage());
        if (!this.debugProvider) {
            return;
        } else if (!await this.debugProvider.isDebuggerInstalled()) {
            return;
        }

        const cwd = workspaceFolder.uri.fsPath;
        const imagePrefix = vscode.workspace.getConfiguration().get("vsdocker.imageUser", null);
        const containerEnv = {};
        const portInfo = await this.debugProvider.resolvePortsFromFile(dockerfile, containerEnv);
        if (!portInfo || !portInfo.debugPort || !portInfo.appPort) {
            vscode.window.showErrorMessage("Cannot resolve debug/application port from Dockerfile.");
            return;
        }

        vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (p) => {
            let appName;
            try {
                // Build/push docker image.
                p.report({ message: "Building docker image..."});
                const shellOpts = Object.assign({ }, shell.execOpts(), { cwd });
                const imageName = await this.buildDockerImage(imagePrefix, shellOpts);

                // Run docker image in k8s container.
                p.report({ message: "Running docker image on Kubernetes..."});
                appName = await this.runAsDeployment(imageName, [portInfo.appPort, portInfo.debugPort], containerEnv);

                // Find the running debug pod.
                p.report({ message: "Finding the debug pod..."});
                const podName = await this.findDebugPod(appName);
                
                // Wait for the debug pod status to be running.
                p.report({ message: "Waiting for the pod to be ready..."});
                await this.waitForPod(podName);
    
                // Setup port-forward.
                p.report({ message: "Setting up port forwarding..."});
                const proxyResult = await this.setupPortForward(podName, portInfo.debugPort, portInfo.appPort);
                
                // Start debug session.
                p.report({ message: `Starting ${this.debugProvider.getDebuggerType()} debug session...`});
                await this.startDebugSession(appName, cwd, proxyResult);
            } catch (error) {
                vscode.window.showErrorMessage(error);
                kubeChannel.showOutput(`Debug on Kubernetes failed. The errors were: ${error}.`);
                if (appName) {
                    await this.cleanupResource(`deployment/${appName}`);
                }
            }
        });
    }

    /**
     * In attach mode, the user should choose the running pod first, then the debugger will attach to it.
     * 
     * @param workspaceFolder the active workspace folder.
     * @param pod the debug pod name.
     */
    public async attach(workspaceFolder: vscode.WorkspaceFolder, pod?: string): Promise<void> {
        // TODO
        return;
    }

    private async buildDockerImage(imagePrefix: string, shellOpts: any): Promise<string> {
        kubeChannel.showOutput("Starting to build/push docker image...", "Docker build/push");
        if (!imagePrefix) {
            // In order to allow local kubernetes cluster (e.g. minikube) to have access to local docker images,
            // need override docker-env before running docker build.
            const dockerEnv = await dockerUtils.resolveKubernetesDockerEnv(this.kubectl);
            shellOpts.env = Object.assign({}, shellOpts.env, dockerEnv);
        }
        const imageName = await dockerUtils.buildAndPushDockerImage(dockerUtils.DockerClient.docker, shellOpts, imagePrefix);
        kubeChannel.showOutput(`Finished building/pushing docker image ${imageName}.`);

        return imageName;
    }

    private async runAsDeployment(image: string, exposedPorts: number[], containerEnv: any): Promise<string> {
        kubeChannel.showOutput(`Starting to run image ${image} on kubernetes cluster...`, "Run on Kubernetes");
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

    private async setupPortForward(podName: string, debugPort: number, appPort: number): Promise<ProxyResult> {
        kubeChannel.showOutput(`Setting up port forwarding on pod ${podName}...`, "Set up port forwarding");
        const proxyResult = await this.createPortForward(this.kubectl, podName, debugPort, appPort);
        kubeChannel.showOutput(`Created port-forward ${proxyResult.proxyDebugPort}:${debugPort} ${proxyResult.proxyAppPort}:${appPort}`);
        
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
                await this.cleanupResource(`deployment/${appName}`);
            }
        });
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

    private async createPortForward(kubectl: Kubectl, podName: string, debugPort: number, appPort: number): Promise<ProxyResult> {
        let portMapping = [];
        // Find a free local port for forwarding data to remote app port.
        let proxyAppPort = 0;
        if (appPort) {
            proxyAppPort = await portfinder.getPortPromise({
                port: appPort
            });
            portMapping.push(proxyAppPort + ":" + appPort);
        }
        // Find a free local port for forwarding data to remote debug port.
        const proxyDebugPort = await portfinder.getPortPromise({
            port: Math.max(10000, Number(proxyAppPort) + 1)
        });
        portMapping.push(proxyDebugPort + ":" + debugPort);

        return {
            proxyProcess: spawnChildProcess(kubectl.path(), ["port-forward", podName, ...portMapping]),
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
}
