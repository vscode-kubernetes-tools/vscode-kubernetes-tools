import * as vscode from "vscode";
import { Kubectl } from "./kubectl";
import { kubeChannel } from "./kubeChannel";
import { sleep } from "./sleep";

export interface Cluster {
    readonly name: string;
    readonly context: string;
    readonly user: string;
    readonly active: boolean;
}

export interface Namespace {
    readonly name: string;
    readonly active: boolean;
}

export interface ClusterConfig {
    readonly server: string;
    readonly certificateAuthority: string;
}

async function getKubeconfig(kubectl: Kubectl): Promise<any> {
    const shellResult = await kubectl.invokeAsync("config view -o json");
    if (shellResult.code !== 0) {
        vscode.window.showErrorMessage(shellResult.stderr);
        return null;
    }
    return JSON.parse(shellResult.stdout);
}

export async function getCurrentClusterConfig(kubectl: Kubectl): Promise<ClusterConfig | undefined> {
    const kubeConfig = await getKubeconfig(kubectl);
    if (!kubeConfig) {
        return undefined;
    }
    const contextConfig = kubeConfig.contexts.find((context) => context.name === kubeConfig["current-context"]);
    const clusterConfig = kubeConfig.clusters.find((cluster) => cluster.name === contextConfig.context.cluster);
    return {
        server: clusterConfig.cluster.server,
        certificateAuthority: clusterConfig.cluster["certificate-authority"]
    };
}

export async function getClusters(kubectl: Kubectl): Promise<Cluster[]> {
    const kubectlConfig = await getKubeconfig(kubectl);
    if (!kubectlConfig) {
        return [];
    }
    const currentContext = kubectlConfig["current-context"];
    const contexts = kubectlConfig.contexts;
    return contexts.map((c) => {
        return {
            name: c.context.cluster,
            context: c.name,
            user: c.context.user,
            active: c.name === currentContext
        };
    });
}

export async function deleteCluster(kubectl: Kubectl, cluster: Cluster): Promise<boolean> {
    const deleteClusterResult = await kubectl.invokeAsyncWithProgress(`config delete-cluster ${cluster.name}`, "Deleting cluster...");
    if (deleteClusterResult.code !== 0) {
        kubeChannel.showOutput(`Failed to delete the specified cluster ${cluster.name} from the kubeconfig: ${deleteClusterResult.stderr}`, `Delete-${cluster.name}`);
        vscode.window.showErrorMessage(`Delete ${cluster.name} failed. See Output window for more details.`);
        return false;
    }

    const deleteUserResult = await kubectl.invokeAsyncWithProgress(`config unset users.${cluster.user}`, "Deleting user...");
    if (deleteUserResult.code !== 0) {
        kubeChannel.showOutput(`Failed to delete user info for cluster ${cluster.name} from the kubeconfig: ${deleteUserResult.stderr}`);
        vscode.window.showErrorMessage(`Delete ${cluster.name} Failed. See Output window for more details.`);
        return false;
    }

    const deleteContextResult = await kubectl.invokeAsyncWithProgress(`config delete-context ${cluster.context}`, "Deleting context...");
    if (deleteContextResult.code !== 0) {
        kubeChannel.showOutput(`Failed to delete the specified cluster's context ${cluster.context} from the kubeconfig: ${deleteContextResult.stderr}`);
        vscode.window.showErrorMessage(`Delete ${cluster.name} Failed. See Output window for more details.`);
        return false;
    }

    vscode.window.showInformationMessage(`Deleted cluster '${cluster.name}' and associated data from the kubeconfig.`);
    return true;
}

export async function getNamespaces(kubectl: Kubectl): Promise<Namespace[]> {
    const shellResult = await kubectl.invokeAsync("get namespaces -o json");
    if (shellResult.code !== 0) {
        vscode.window.showErrorMessage(shellResult.stderr);
        return [];
    }
    const ns = JSON.parse(shellResult.stdout);
    const currentNS = await currentNamespace(kubectl);
    return ns.items.map((item) => {
        return {
            name: item.metadata.name,
            active: item.metadata.name === currentNS
        };
    });
}

async function currentNamespace(kubectl: Kubectl): Promise<string> {
    const kubectlConfig = await getKubeconfig(kubectl);
    if (!kubectlConfig) {
        return "";
    }
    const ctxName = kubectlConfig["current-context"];
    const currentContext = kubectlConfig.contexts.find((ctx) => ctx.name === ctxName);
    if (!currentContext) {
        return "";
    }
    return currentContext.context.namespace || "default";
}

export async function switchNamespace(kubectl: Kubectl, namespace: string): Promise<boolean> {
    const shellResult = await kubectl.invokeAsync("config current-context");
    if (shellResult.code !== 0) {
        kubeChannel.showOutput(`Failed. Cannot get the current context: ${shellResult.stderr}`, `Switch namespace ${namespace}`);
        vscode.window.showErrorMessage("Switch namespace failed. See Output window for more details.");
        return false;
    }
    const updateResult = await kubectl.invokeAsyncWithProgress(`config set-context ${shellResult.stdout.trim()} --namespace="${namespace}"`,
        "Switching namespace...");
    if (updateResult.code !== 0) {
        kubeChannel.showOutput(`Failed to switch the namespace: ${shellResult.stderr}`, `Switch namespace ${namespace}`);
        vscode.window.showErrorMessage("Switch namespace failed. See Output window for more details.");
        return false;
    }
    return true;
}

/**
 * Run the specified image in the kubernetes cluster.
 * 
 * @param kubectl the kubectl client.
 * @param deploymentName the deployment name.
 * @param image the docker image.
 * @param exposedPorts the exposed ports.
 * @param env the additional environment variables when running the docker container.
 * @return the deployment name.
 */
export async function runAsDeployment(kubectl: Kubectl, deploymentName: string, image: string, exposedPorts: number[], env: any): Promise<string> {
    let imageName = image.split(":")[0];
    let imagePrefix = imageName.substring(0, imageName.lastIndexOf("/")+1);
    if (!deploymentName) {
        let baseName = imageName.substring(imageName.lastIndexOf("/")+1);
        const deploymentName = `${baseName}-${Date.now()}`;
    }
    let runCmd = [
        "run",
        deploymentName,
        `--image=${image}`,
        imagePrefix ? "" : "--image-pull-policy=Never",
        ...exposedPorts.map((port) => `--port=${port}`),
        ...Object.keys(env || {}).map((key) => `--env="${key}=${env[key]}"`)
    ];
    const runResult = await kubectl.invokeAsync(runCmd.join(" "));
    if (runResult.code !== 0) {
        throw new Error(`Failed to run the image "${image}" on Kubernetes: ${runResult.stderr}`);
    }
    return deploymentName;
}

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
    while (true) {
        const shellResult = await kubectl.invokeAsync(`get pod/${podName} --no-headers`);
        if (shellResult.code !== 0) {
            throw new Error(`Failed to get pod status: ${shellResult.stderr}`);
        }
        const status = shellResult.stdout.split(/\s+/)[2];
        kubeChannel.showOutput(`pod/${podName} status: ${status}`);
        if (status === "Running") {
            return;
        } else if (!isTransientPodState(status)) {
            const logsResult = await kubectl.invokeAsync(`logs pod/${podName}`);
            kubeChannel.showOutput(`Failed to start the pod "${podName}". Its status is "${status}".
                Pod logs:\n${logsResult.code === 0 ? logsResult.stdout : logsResult.stderr}`);
            throw new Error(`Failed to start the pod "${podName}". Its status is "${status}".`);
        }
    
        await sleep(1000);
    }
}

function isTransientPodState(status: string): boolean {
    return status === "ContainerCreating" || status === "Pending" || status === "Succeeded";
}

/**
 * Get the specified resource information.
 *
 * @param kubectl the kubectl client.
 * @param resourceId the resource id.
 * @return the result as a json object, or undefined if errors happen.
 */
export async function getResourceAsJson(kubectl: Kubectl, resourceId: string): Promise<any> {
    const shellResult = await kubectl.invokeAsync(`get ${resourceId} -o json`);
    if (shellResult.code !== 0) {
        vscode.window.showErrorMessage(shellResult.stderr);
        return;
    }
    return JSON.parse(shellResult.stdout.trim());
}
