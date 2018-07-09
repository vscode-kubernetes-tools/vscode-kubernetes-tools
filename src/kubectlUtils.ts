import * as vscode from "vscode";
import { Kubectl } from "./kubectl";
import { kubeChannel } from "./kubeChannel";
import { sleep } from "./sleep";
import { ObjectMeta, KubernetesCollection, DataResource, Namespace, Pod, KubernetesResource } from './kuberesources.objectmodel';
import { failed } from "./errorable";

export interface KubectlContext {
    readonly clusterName: string;
    readonly contextName: string;
    readonly userName: string;
    readonly active: boolean;
}

export interface KubernetesObject {
    readonly name: string;
}

export interface NamespaceInfo extends KubernetesObject {
    readonly active: boolean;
}

export interface PodSelector extends KubernetesObject {
    readonly selector: object;
}

export interface PodInfo extends KubernetesObject {
    readonly namespace: string;
    readonly nodeName: string;
}

export interface ClusterConfig {
    readonly server: string;
    readonly certificateAuthority: string;
}

export interface DataHolder {
    readonly metadata: ObjectMeta;
    readonly data: any;
}

async function getKubeconfig(kubectl: Kubectl): Promise<any> {
    const shellResult = await kubectl.asJson<any>("config view -o json");
    if (failed(shellResult)) {
        vscode.window.showErrorMessage(shellResult.error[0]);
        return null;
    }
    return shellResult.result;
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

export async function getContexts(kubectl: Kubectl): Promise<KubectlContext[]> {
    const kubectlConfig = await getKubeconfig(kubectl);
    if (!kubectlConfig) {
        return [];
    }
    const currentContext = kubectlConfig["current-context"];
    const contexts = kubectlConfig.contexts;
    return contexts.map((c) => {
        return {
            clusterName: c.context.cluster,
            contextName: c.name,
            userName: c.context.user,
            active: c.name === currentContext
        };
    });
}

export async function deleteCluster(kubectl: Kubectl, cluster: KubectlContext): Promise<boolean> {
    const deleteClusterResult = await kubectl.invokeAsyncWithProgress(`config delete-cluster ${cluster.clusterName}`, "Deleting cluster...");
    if (deleteClusterResult.code !== 0) {
        kubeChannel.showOutput(`Failed to delete the specified cluster ${cluster.clusterName} from the kubeconfig: ${deleteClusterResult.stderr}`, `Delete ${cluster.contextName}`);
        vscode.window.showErrorMessage(`Delete ${cluster.contextName} failed. See Output window for more details.`);
        return false;
    }

    const deleteUserResult = await kubectl.invokeAsyncWithProgress(`config unset users.${cluster.userName}`, "Deleting user...");
    if (deleteUserResult.code !== 0) {
        kubeChannel.showOutput(`Failed to delete user info for context ${cluster.contextName} from the kubeconfig: ${deleteUserResult.stderr}`);
        vscode.window.showErrorMessage(`Delete ${cluster.contextName} Failed. See Output window for more details.`);
        return false;
    }

    const deleteContextResult = await kubectl.invokeAsyncWithProgress(`config delete-context ${cluster.contextName}`, "Deleting context...");
    if (deleteContextResult.code !== 0) {
        kubeChannel.showOutput(`Failed to delete the specified cluster's context ${cluster.contextName} from the kubeconfig: ${deleteContextResult.stderr}`);
        vscode.window.showErrorMessage(`Delete ${cluster.contextName} Failed. See Output window for more details.`);
        return false;
    }

    vscode.window.showInformationMessage(`Deleted context '${cluster.contextName}' and associated data from the kubeconfig.`);
    return true;
}

export async function getDataHolders(resource: string, kubectl: Kubectl): Promise<DataHolder[]> {
    const currentNS = await currentNamespace(kubectl);

    const depList = await kubectl.asJson<KubernetesCollection<DataResource>>(`get ${resource} -o json --namespace=${currentNS}`);
    if (failed(depList)) {
        vscode.window.showErrorMessage(depList.error[0]);
        return [];
    }
    return depList.result.items;
}

export async function getGlobalResources(kubectl: Kubectl, resource: string): Promise<KubernetesResource[]> {
    const rsrcs = await kubectl.asJson<KubernetesCollection<KubernetesResource>>(`get ${resource} -o json`);
    if (failed(rsrcs)) {
        vscode.window.showErrorMessage(rsrcs.error[0]);
        return [];
    }
    return rsrcs.result.items.map((item) => {
        return {
            metadata: item.metadata,
            kind: resource
        };
    });
}

export async function getNamespaces(kubectl: Kubectl): Promise<NamespaceInfo[]> {
    const ns = await kubectl.asJson<KubernetesCollection<Namespace>>("get namespaces -o json");
    if (failed(ns)) {
        vscode.window.showErrorMessage(ns.error[0]);
        return [];
    }
    const currentNS = await currentNamespace(kubectl);
    return ns.result.items.map((item) => {
        return {
            name: item.metadata.name,
            active: item.metadata.name === currentNS
        };
    });
}

export async function getServices(kubectl: Kubectl): Promise<PodSelector[]> {
    return getPodSelector('services', kubectl);
}

export async function getDeployments(kubectl: Kubectl): Promise<PodSelector[]> {
    return getPodSelector('deployments', kubectl);
}

export async function getPodSelector(resource: string, kubectl: Kubectl): Promise<PodSelector[]> {
    const currentNS = await currentNamespace(kubectl);

    const shellResult = await kubectl.asJson<KubernetesCollection<any>>(`get ${resource} -o json --namespace=${currentNS}`);
    if (failed(shellResult)) {
        vscode.window.showErrorMessage(shellResult.error[0]);
        return [];
    }
    return shellResult.result.items.map((item) => {
        return {
            name: item.metadata.name,
            selector: item.spec.selector
        };
    });
}

export async function getPods(kubectl: Kubectl, selector: any, namespace: string = null): Promise<PodInfo[]> {
    const ns = namespace || await currentNamespace(kubectl);
    let nsFlag = `--namespace=${ns}`;
    if (ns === 'all') {
        nsFlag = '--all-namespaces';
    }
    const labelStr = getResourceSelectorString(selector);
    const pods = await kubectl.asJson<KubernetesCollection<Pod>>(`get pods -o json ${nsFlag} ${labelStr}`);
    if (failed(pods)) {
        vscode.window.showErrorMessage(pods.error[0]);
        return [];
    }
    return pods.result.items.map((item) => {
        return {
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            nodeName: item.spec.nodeName
        };
    });
}

export function getResourceSelectorString(selector: any): string {
    const labels = [];
    let matchLabelObj = selector;
    if (selector && selector.matchLabels) {
        matchLabelObj = selector.matchLabels;
    }
    if (matchLabelObj) {
        Object.keys(matchLabelObj).forEach((key) => {
            labels.push(`${key}=${matchLabelObj[key]}`);
        });
    }
    let labelStr = "";
    if (labels.length > 0) {
        labelStr = "--selector=" + labels.join(",");
    }
    return labelStr;
}

export async function currentNamespace(kubectl: Kubectl): Promise<string> {
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
    const imageName = image.split(":")[0];
    const imagePrefix = imageName.substring(0, imageName.lastIndexOf("/")+1);

    if (!deploymentName) {
        const baseName = imageName.substring(imageName.lastIndexOf("/")+1);
        deploymentName = `${baseName}-${Date.now()}`;
    }

    const runCmd = [
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
export async function findPodsByLabel(kubectl: Kubectl, labelQuery: string): Promise<KubernetesCollection<Pod>> {
    const getResult = await kubectl.asJson<KubernetesCollection<Pod>>(`get pods -o json -l ${labelQuery}`);
    if (failed(getResult)) {
        throw new Error('Kubectl command failed: ' + getResult.error[0]);
    }
    return getResult.result;
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
export async function getResourceAsJson<T extends KubernetesResource | KubernetesCollection<KubernetesResource>>(kubectl: Kubectl, resourceId: string): Promise<T | undefined> {
    const shellResult = await kubectl.asJson<T>(`get ${resourceId} -o json`);
    if (failed(shellResult)) {
        vscode.window.showErrorMessage(shellResult.error[0]);
        return undefined;
    }
    return shellResult.result;
}

/**
 * Parse column based output which is seperated by whitespace(s) from kubectl or similar sources
 * for example, kubectl get po
 * @param lineOutput raw output with headers from kubectl or similar sources
 * @return array of objects with key as column header and value
 */
export function parseLineOutput(lineOutput: string[]): { [key: string]: string }[] {
    const headers = lineOutput.shift();
    if (!headers) {
        return [];
    }
    const parsedHeaders = headers.toLowerCase().replace(/\s+/g, '|').split('|');
    return lineOutput.map((line) => {
        const lineInfoObject = {};
        const bits = line.replace(/\s+/g, '|').split('|');
        bits.forEach((columnValue, index) => {
            lineInfoObject[parsedHeaders[index]] = columnValue;
        });
        return lineInfoObject;
    });
}
