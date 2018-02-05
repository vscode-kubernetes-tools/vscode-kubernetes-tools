import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import * as docker from "../docker";
import { kubeChannel } from "../kubeChannel";
import { Kubectl } from "../kubectl";
import { getKubeconfig } from "../kubectlUtils";
import { shell, ShellResult } from "../shell";
import { sleep } from "../sleep";

/**
 * Build the docker image first. If imagePrefix is not empty, push the image to remote docker hub, too.
 * 
 * @param dockerClient the possible dockerClient： docker or docker-compose.
 * @param shellOpts any option available to Node.js's child_process.exec().
 * @param imagePrefix the image prefix for docker images (e.g. 'docker.io/brendanburns').
 * @return the image name.
 */
export async function buildAndPushDockerImage(dockerClient: string, shellOpts: any, imagePrefix?: string): Promise<string> {
    const cwd = shellOpts.cwd || vscode.workspace.rootPath;
    const image = await getDefaultImageName(cwd, imagePrefix);
    await buildDockerImage(dockerClient, image, shellOpts);
    if (imagePrefix) {
        await pushDockerImage(dockerClient, image, shellOpts);
    }
    return image;
}

async function getDefaultImageName(cwd: string, imagePrefix?: string): Promise<string> {
    const name = docker.sanitiseTag(path.basename(cwd));
    const version = await findVersion(cwd);
    let image = `${name}:${version}`;
    if (imagePrefix) {
        image = imagePrefix + "/" + image;
    }
    return image;
}

async function findVersion(cwd: string): Promise<string> {
    const shellOpts = Object.assign({ }, shell.execOpts(), { cwd });
    const shellResult = await shell.execCore('git describe --always --dirty', shellOpts);
    return shellResult.code !== 0 ? "latest" : shellResult.stdout.trim();
}

async function buildDockerImage(dockerClient: string, image: string, shellOpts: any): Promise<void> {
    // Build docker image.
    const buildResult = await shell.execCore(`${dockerClient} build -t ${image} .`, shellOpts);
    if (buildResult.code !== 0) {
        kubeChannel.showOutput(buildResult.stderr, 'Docker build');
        throw new Error(`Image build failed: ${buildResult.stderr}`);
    }
    kubeChannel.showOutput(image + ' built.', "Docker build");
};

async function pushDockerImage(dockerClient: string, image: string, shellOpts: any): Promise<void> {
    // Push docker image.
    const pushResult = await shell.execCore(`${dockerClient} push ${image}`, shellOpts);
    if (pushResult.code !== 0) {
        kubeChannel.showOutput(pushResult.stderr, 'Docker push');
        throw new Error(`Image push failed: ${pushResult.stderr}`);
    }
    kubeChannel.showOutput(image + ' pushed.', "Docker push");
}

/**
 * When using the command "minikube docker-env" to get the local kubernetes docker env, it needs run with the admin privilege.
 * To workaround this, this function will try to resolve the equivalent docker env from kubeconfig instead.
 */
export async function resolveDockerEnv(kubectl: Kubectl): Promise<{}> {
    const dockerEnv = {};
    const versionResult = await shell.exec(`docker version --format "{{.Client.APIVersion}}"`);
    dockerEnv["DOCKER_API_VERSION"] = "1.23";
    if (versionResult.code === 0) {
        dockerEnv["DOCKER_API_VERSION"] = versionResult.stdout.trim();
    }
    const kubeConfig = await getKubeconfig(kubectl);
    if (!kubeConfig) {
        return {};
    }
    const contextConfig = kubeConfig.contexts.find((context) => context.name === kubeConfig["current-context"]);
    const clusterConfig = kubeConfig.clusters.find((cluster) => cluster.name === contextConfig.context.cluster);
    const server = clusterConfig.cluster.server;
    const certificate = clusterConfig.cluster["certificate-authority"];
    if (!certificate) {
        return {};
    }
    if (/^https/.test(server)) {
        dockerEnv["DOCKER_TLS_VERIFY"] = 1;
    }
    dockerEnv["DOCKER_HOST"] = server.replace(/^https?:/, "tcp:").replace(/:\d+$/, ":2376");
    const certDir = path.dirname(certificate);
    if (fs.existsSync(path.join(certDir, "certs"))) {
        dockerEnv["DOCKER_CERT_PATH"] = path.join(certDir, "certs");
    } else {
        dockerEnv["DOCKER_CERT_PATH"] = certDir;
    }
    return dockerEnv;
}

/**
 * Run the specified image in the kubernetes cluster.
 * 
 * @param kubectl the kubectl client. 
 * @param image the docker image.
 * @param exposedPorts the exposed ports.
 * @param env the additional environment variables when running the docker container.
 */
export async function runDockerImageInK8s(kubectl: Kubectl, image: string, exposedPorts: string[], env: any): Promise<string> {
    let imageName = image.split(":")[0];
    let imagePrefix = imageName.substring(0, imageName.lastIndexOf("/")+1);
    let baseName = imageName.substring(imageName.lastIndexOf("/")+1);
    const deploymentName = `${baseName}-debug-${Date.now()}`;
    let runCmd = [
        "run",
        deploymentName,
        `--image=${image}`,
        !imagePrefix ? " --image-pull-policy=Never" : "",
        ...exposedPorts.map((port) => port ? `--port=${port}` : ""),
        ...Object.keys(env || {}).map((key) => `--env="${key}=${env[key]}"`)
    ];
    const runResult = await kubectl.invokeAsync(runCmd.join(" "));
    if (runResult.code !== 0) {
        throw new Error(`Failed to run the image "${image}" on kubernetes: ${runResult.stderr}`);
    }
    return deploymentName;
};

/**
 * Query the pod list for the specified label.
 * 
 * @param kubectl the kubectl client.
 * @param labelQuery the query label.
 * @return the pod list.
 */
export async function findPodsByLabel(kubectl: Kubectl, labelQuery: string): Promise<any> {
    const getResult = await kubectl.invokeAsync(`get pods -o json -l ${labelQuery}`);
    if (getResult.code !== 0) {
        throw new Error('Kubectl command failed: ' + getResult.stderr);
    }
    try {
        return JSON.parse(getResult.stdout);
    } catch (ex) {
        throw new Error('unexpected error: ' + ex);
    }
}

/**
 * Wait and block until the specified pod's status becomes running.
 * 
 * @param kubectl the kubectl client.
 * @param podName the pod name.
 */
export async function waitForRunningPod(kubectl: Kubectl, podName: string): Promise<void> {
    const shellResult = await kubectl.invokeAsync(`get pod/${podName} --no-headers`);
    if (shellResult.code !== 0) {
        kubeChannel.showOutput(`Failed to get pod status: ${shellResult.stderr}`, "Query pod status");
        throw new Error(`Failed to get pod status: ${shellResult.stderr}`);
    }
    const status = shellResult.stdout.split(/\s+/)[2];
    kubeChannel.showOutput(`pod/${podName} status: ${status}`, "Query pod status");
    if (status === "Running") {
        return;
    } else if (status !== "ContainerCreating" && status !== "Pending" && status !== "Succeeded") {
        const logsResult = await kubectl.invokeAsync(`logs pod/${podName}`);
        kubeChannel.showOutput(`Failed to start the pod "${podName}", it's status is "${status}".\n
            See more details from the pod logs:\n${logsResult.code === 0 ? logsResult.stdout : logsResult.stderr}`, `Query pod status`);
        throw new Error(`Failed to start the pod "${podName}", it's status is "${status}".`);
    }

    await sleep(1000);
    await waitForRunningPod(kubectl, podName);
}

/**
 * Install a vscode extension programmatically.
 * 
 * @param extensionId the extension id.
 */
export async function installVscodeExtension(extensionId: string): Promise<boolean> {
    const vscodeCliPath = path.join(path.dirname(process.argv0), "bin", "code");
    const shellResult = await shell.exec(`"${vscodeCliPath}" --install-extension ${extensionId}`);
    if (shellResult.code === 0) {
        const restartAns = await vscode.window.showInformationMessage(`Extension '${extensionId}' was successfully installed. Restart to enable it.`, "Restart Now");
        if (restartAns === "Restart Now") {
            await vscode.commands.executeCommand("workbench.action.reloadWindow");
            return true;
        }
    }
    return false;
}
