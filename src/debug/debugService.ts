import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ChildProcess } from "child_process";

import { IDebugProvider, IDockerParser } from "./debugInterfaces";
import * as debugUtils from "./debugUtils";
import { DockerfileParser } from "./dockerfileParser";
import * as providerRegistry from "./providerRegistry";

import * as docker from "../docker";
import { kubeChannel } from "../kubeChannel";
import { Kubectl } from "../kubectl";
import { getKubeconfig } from "../kubectlUtils";
import { shell } from "../shell";
import { sleep } from "../sleep";

export enum DockerClient {
    docker = "docker",
    dockerCompose = "docker-compose"
}

export interface IDebugService {
    launchDebug(workspaceFolder: vscode.WorkspaceFolder): Promise<void>;
    attachDebug(workspaceFolder: vscode.WorkspaceFolder, pod?: string): Promise<void>;
}

export class DebugService implements IDebugService {
    private debugProvider: IDebugProvider;
    private dockerParser: IDockerParser;

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
    public async launchDebug(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
        if (!workspaceFolder) {
            return;
        }
        // TODO: Support docker-compose.yml
        const dockerfilePath = path.join(workspaceFolder.uri.fsPath, "Dockerfile");
        if (!fs.existsSync(dockerfilePath)) {
            vscode.window.showErrorMessage(`No Dockerfile found at the workspace ${workspaceFolder.name}`);
            return;
        }
        this.dockerParser = new DockerfileParser(dockerfilePath);
        this.debugProvider = await providerRegistry.getDebugProvider(this.dockerParser.getBaseImage());
        if (!this.debugProvider) {
            return;
        } else if (!await this.debugProvider.isDebuggerInstalled()) { // Check the required debugger extension is installed or not.
            return;
        }

        const cwd = workspaceFolder.uri.fsPath;
        const imagePrefix = vscode.workspace.getConfiguration().get("vsdocker.imageUser", null);
        const containerEnv= {};
        const portInfo = await this.debugProvider.getDockerResolver().resolvePortsFromFile(this.dockerParser, containerEnv);
        if (!portInfo.debug) {
            vscode.window.showErrorMessage("Cannot resolve debug port from Dockerfile.");
            return;
        }
        if (!portInfo.app || !Number.isInteger(Number(portInfo.app))) {
            vscode.window.showErrorMessage(`Cannot resolve application port from Dockerfile.`);
            return;
        }

        vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (p) => {
            let appName;
            try {
                // Build/push docker image.
                p.report({ message: "Building docker image..."});
                kubeChannel.showOutput("Starting to build/push docker image...", "Docker build/push");
                const shellOpts = Object.assign({ }, shell.execOpts(), { cwd });
                if (!imagePrefix) {
                    // In order to allow local kubernetes cluster (e.g. minikube) to have access to local docker images,
                    // need override docker-env before running docker build.
                    const dockerEnv = await debugUtils.resolveDockerEnv(this.kubectl);
                    shellOpts.env = Object.assign({}, shellOpts.env, dockerEnv);
                }
                const image = await debugUtils.buildAndPushDockerImage(DockerClient.docker, shellOpts, imagePrefix);
                kubeChannel.showOutput(`Finished to build/push docker image ${image}.`);

                // Run docker image in k8s container.
                p.report({ message: "Running docker image on k8s..."});
                kubeChannel.showOutput(`Starting to run image ${image} on kubernetes cluster...`, "Run on kubernetes");
                appName = await debugUtils.runDockerImageInK8s(this.kubectl, image, [portInfo.app, portInfo.debug], containerEnv);
                kubeChannel.showOutput(`Finished to run image ${image} as a deployment ${appName} on kubernetes cluster.`);

                // Find the running debug pod.
                p.report({ message: "Finding the debug pod..."});
                kubeChannel.showOutput(`Starting to find the pod by the label run=${appName}`, "Find debug pod");
                const podList = await debugUtils.findPodsByLabel(this.kubectl, `run=${appName}`);
                if (podList.items.length === 0) {
                    throw new Error("Failed to find debug pod.");
                }
                const podName = podList.items[0].metadata.name;
                kubeChannel.showOutput(`Finished to find the running debug pod: ${podName}`);
                
                // Wait for the debug pod status to be running.
                p.report({ message: "Waiting for the pod to be ready..."});
                kubeChannel.showOutput(`Starting to wait the pod ${podName} status to become running...`, "Wait for pod");
                await debugUtils.waitForRunningPod(this.kubectl, podName);
                kubeChannel.showOutput(`Finshed to wait.`);
    
                // Setup port-forward.
                p.report({ message: "Creating port-forwarding..."});
                kubeChannel.showOutput(`Starting to create port-forward on pod ${podName}...`, "port-forward");
                const proxyResult = await this.createPortForward(podName, portInfo.debug, portInfo.app);
                kubeChannel.showOutput(`Finished to create port-forward ${proxyResult.proxyDebugPort}:${portInfo.debug} ${proxyResult.proxyAppPort}:${portInfo.app}`);

                // Wait for the port-forward proxy to be ready.
                p.report({ message: "Waiting for port-forwarding ready..."});
                kubeChannel.showOutput("Starting to wait the port proxy to be ready...", "Wait for port-forward");
                await this.waitForProxyReady(proxyResult.proxyProcess);
                kubeChannel.showOutput("Finished to wait.");
                
                // Start debug session.
                p.report({ message: `Starting ${this.debugProvider.getDebuggerType()} debug session...`});
                kubeChannel.showOutput("Starting to start debug session...", "Start debug");
                const sessionName = appName || `${Date.now()}`;
                await this.startDebugging(cwd, sessionName, proxyResult.proxyDebugPort, proxyResult.proxyAppPort, async () => {
                    proxyResult.proxyProcess.kill();
                    if (appName) {
                        await this.cleanupResource(`deployment/${appName}`);
                    }
                });
            } catch (error) {
                vscode.window.showErrorMessage(error);
                kubeChannel.showOutput(`Debug(Launch) on kubernetes failed. See the errors: ${error}.`);
                if (appName) {
                    await this.cleanupResource(`deployment/${appName}`);
                }
            }
            return null;
        });
    }

    /**
     * In attach mode, the user should choose the running pod first, then the debugger will attach to it.
     * 
     * @param workspaceFolder the active workspace folder.
     * @param pod the debug pod name.
     */
    public async attachDebug(workspaceFolder: vscode.WorkspaceFolder, pod?: string): Promise<void> {
        // TODO
        return;
    }

    private async createPortForward(podName, debugPort, appPort): Promise<any> {
        const portMapping = [];
        const portfinder = require('portfinder');
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

        let bin = vscode.workspace.getConfiguration('vs-kubernetes')['vs-kubernetes.kubectl-path'];
        if (!bin) {
            bin = 'kubectl';
        }
        
        return {
            proxyProcess: require('child_process').spawn(bin, ["port-forward", podName, ...portMapping]),
            proxyDebugPort,
            proxyAppPort
        };
    }

    private async waitForProxyReady(proxyProcess: ChildProcess): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const forwardingRegExp = /Forwarding\s+from\s+127\.0\.0\.1:/;
            let isProxyReady = false;

            proxyProcess.stdout.on('data', async (data) => {
                const message = `${data}`;
                if (!isProxyReady && forwardingRegExp.test(message)) {
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
                resolve();
            });
        });
    }

    private async startDebugging(workspaceFolder: string, sessionName: string, proxyDebugPort: any, proxyAppPort: any, onTerminateCallback: () => Promise<any>) {
        const disposables: vscode.Disposable[] = [];
        disposables.push(vscode.debug.onDidStartDebugSession((debugSession) => {
            if (debugSession.name === sessionName) {
                kubeChannel.showOutput("The debug session is started, you could start debugging your application now.");
                if (proxyAppPort) {
                    kubeChannel.showOutput(`You can access the application via the local proxied socket port ${proxyAppPort}, e.g. http://localhost:${proxyAppPort}`);
                    vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`http://localhost:${proxyAppPort}`));
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

    async cleanupResource(resourceId: string) {
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
}
