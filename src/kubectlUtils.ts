import * as vscode from "vscode";
import { Kubectl } from "./kubectl";
import { kubeChannel } from "./kubeChannel";
import { sleep } from "./sleep";
import { ObjectMeta, KubernetesCollection, DataResource, Namespace, Pod, KubernetesResource, CRD } from './kuberesources.objectmodel';
import { failed, Errorable } from "./errorable";
import { ExecResult } from "./binutilplusplus";
import { shellMessage } from "./shell";
import { ResourceKind } from "./kuberesources";

export interface KubectlContext {
    readonly clusterName: string;
    readonly contextName: string;
    readonly userName: string;
    readonly active: boolean;
}

interface Kubeconfig {
    readonly apiVersion: string;
    readonly 'current-context': string;
    readonly clusters: {
        readonly name: string;
        readonly cluster: {
            readonly server: string;
            readonly 'certificate-authority'?: string;
            readonly 'certificate-authority-data'?: string;
        };
    }[] | undefined;
    readonly contexts: {
        readonly name: string;
        readonly context: {
            readonly cluster: string;
            readonly user: string;
            readonly namespace?: string;
        };
    }[] | undefined;
    readonly users: {
        readonly name: string;
        readonly user: {};
    }[] | undefined;
}

export interface KubernetesObject {
    readonly name: string;
    readonly metadata: ObjectMeta;
}

export interface NamespaceInfo extends KubernetesObject {
    readonly active: boolean;
}

export interface HasSelector extends KubernetesObject {
    readonly selector: object;
}

export interface PodInfo extends KubernetesObject {
    readonly namespace: string;
    readonly nodeName: string;
    readonly status: string;
}

export interface ClusterConfig {
    readonly server: string;
    readonly certificateAuthority: string | undefined;
}

export interface DataHolder {
    readonly metadata: ObjectMeta;
    readonly data: any;
}

export interface ConfigReadOptions {
    readonly silent?: boolean;  // TODO: get rid of this because it is ambiguous - but convenient for now!
}

async function getKubeconfig(kubectl: Kubectl, options: ConfigReadOptions): Promise<Kubeconfig | null> {
    const config = await kubectl.readJSON<any>("config view -o json");
    if (ExecResult.failed(config)) {
        if (options.silent) {
            console.log(ExecResult.failureMessage(config, {}));
        } else {
            kubectl.reportFailure(config, {});
        }
        return null;
    }
    return config.result;
}

export async function getCurrentClusterConfig(kubectl: Kubectl, options: ConfigReadOptions): Promise<ClusterConfig | undefined> {
    const kubeConfig = await getKubeconfig(kubectl, options);
    if (!kubeConfig || !kubeConfig.clusters || !kubeConfig.contexts) {
        return undefined;
    }
    const contextConfig = kubeConfig.contexts.find((context) => context.name === kubeConfig["current-context"])!;  // current-context should refer to an actual context
    const clusterConfig = kubeConfig.clusters.find((cluster) => cluster.name === contextConfig.context.cluster)!;
    return {
        server: clusterConfig.cluster.server,
        certificateAuthority: clusterConfig.cluster["certificate-authority"]
    };
}

export async function getContexts(kubectl: Kubectl, options: ConfigReadOptions): Promise<KubectlContext[]> {
    const kubectlConfig = await getKubeconfig(kubectl, options);
    if (!kubectlConfig) {
        return [];
    }
    const currentContext = kubectlConfig["current-context"];
    const contexts = kubectlConfig.contexts || [];
    return contexts.map((c) => {
        return {
            clusterName: c.context.cluster,
            contextName: c.name,
            userName: c.context.user,
            active: c.name === currentContext
        };
    });
}

export async function getCurrentContext(kubectl: Kubectl, options: ConfigReadOptions): Promise<KubectlContext | undefined> {
    const contexts = await getContexts(kubectl, options);
    return contexts.find((c) => c.active);
}

export async function deleteCluster(kubectl: Kubectl, context: KubectlContext): Promise<boolean> {
    const deleteClusterResult = await kubectl.invokeCommandWithFeedback(`config delete-cluster ${context.clusterName}`, "Deleting cluster...");
    if (ExecResult.failed(deleteClusterResult)) {
        const whatFailed = `Failed to remove the underlying cluster for context ${context.clusterName} from the kubeconfig`;
        kubeChannel.showOutput(ExecResult.failureMessage(deleteClusterResult, { whatFailed }), `Delete ${context.contextName}`);

        if (deleteClusterResult.resultKind === 'exec-bin-not-found') {
            // Special handling for the first step in the process - if kubectl doesn't exist,
            // prompt to install dependencies and _don't try any further_.  (Not worth trying to
            // be this graceful about the possibility of kubectl disappearing between the first and
            // last steps though!)
            kubectl.promptInstallDependencies(deleteClusterResult, `Can't delete ${context.contextName}): kubectl not found`);
            return false;
        }

        vscode.window.showWarningMessage(`Failed to remove the underlying cluster for context ${context.contextName}. See Output window for more details.`);
    }

    const deleteUserResult = await kubectl.invokeCommandWithFeedback(`config unset users.${context.userName}`, "Deleting user...");
    if (ExecResult.failed(deleteUserResult)) {
        const whatFailed = `Failed to remove the underlying user for context ${context.contextName} from the kubeconfig`;
        kubeChannel.showOutput(ExecResult.failureMessage(deleteUserResult, { whatFailed }));
        vscode.window.showWarningMessage(`Failed to remove the underlying user for context ${context.contextName}. See Output window for more details.`);
    }

    const deleteContextResult = await kubectl.invokeCommandWithFeedback(`config delete-context ${context.contextName}`, "Deleting context...");
    if (ExecResult.failed(deleteContextResult)) {
        const whatFailed = `Failed to delete the specified cluster's context ${context.contextName} from the kubeconfig`;
        kubeChannel.showOutput(ExecResult.failureMessage(deleteContextResult, { whatFailed }));
        vscode.window.showErrorMessage(`Delete ${context.contextName} failed. See Output window for more details.`);
        return false;
    }

    vscode.window.showInformationMessage(`Deleted context '${context.contextName}' and associated data from the kubeconfig.`);
    return true;
}

export async function getAsDataResources(resource: string, kubectl: Kubectl): Promise<DataResource[]> {
    const currentNS = await currentNamespace(kubectl);

    const resources = await kubectl.asJson<KubernetesCollection<DataResource>>(`get ${resource} -o json --namespace=${currentNS}`);
    if (failed(resources)) {
        vscode.window.showErrorMessage(resources.error[0]);
        return [];
    }
    return resources.result.items;
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

export async function getCRDTypes(kubectl: Kubectl): Promise<CRD[]> {
    const crdTypes = await kubectl.asJson<KubernetesCollection<any>>(`get crd -o json`);
    if (failed(crdTypes)) {
        vscode.window.showErrorMessage(crdTypes.error[0]);
        return [];
    }

    return crdTypes.result.items.map((item) => {
        return {
            metadata: item.metadata,
            kind: item.spec.names.kind,
            spec: item.spec
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
            metadata: item.metadata,
            active: item.metadata.name === currentNS
        };
    });
}

export async function getResourceWithSelector(resource: string, kubectl: Kubectl): Promise<HasSelector[]> {
    const currentNS = await currentNamespace(kubectl);

    const shellResult = await kubectl.asJson<KubernetesCollection<any>>(`get ${resource} -o json --namespace=${currentNS}`);
    if (failed(shellResult)) {
        vscode.window.showErrorMessage(shellResult.error[0]);
        return [];
    }
    return shellResult.result.items.map((item) => {
        return {
            name: item.metadata.name,
            metadata: item.metadata,
            selector: item.spec.selector
        };
    });
}

export async function getPods(kubectl: Kubectl, selector: any, namespace: string | null = null): Promise<PodInfo[]> {
    const ns = namespace || await currentNamespace(kubectl);
    let nsFlag = `--namespace=${ns}`;
    if (ns === 'all') {
        nsFlag = '--all-namespaces';
    }
    const labels = Array.of<string>();
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

    const pods = await kubectl.readTable(`get pods -o wide ${nsFlag} ${labelStr}`);
    if (ExecResult.failed(pods)) {
        kubectl.reportFailure(pods, {});
        return [];
    }

    return pods.result.map((item) => {
        return {
            name: item.name,
            namespace: item.namespace || ns,
            nodeName: item.node,
            status: item.status,
            metadata: { name: item.name, namespace: item.namespace || ns },
        };
    });
}

export async function currentNamespace(kubectl: Kubectl): Promise<string> {
    const kubectlConfig = await getKubeconfig(kubectl, { silent: false }); // TODO: should this be silent
    if (!kubectlConfig) {
        return "";
    }
    const ctxName = kubectlConfig["current-context"];
    const currentContext = (kubectlConfig.contexts || []).find((ctx) => ctx.name === ctxName);
    if (!currentContext) {
        return "";
    }
    return currentContext.context.namespace || "default";
}

export async function currentNamespaceArg(kubectl: Kubectl): Promise<string> {
    const ns = await currentNamespace(kubectl);
    if (ns.length === 0) {
        return '';
    }
    return `--namespace ${ns}`;
}

export const onDidChangeNamespaceEmitter = new vscode.EventEmitter<string>();

export async function switchNamespace(kubectl: Kubectl, namespace: string): Promise<boolean> {
    const er = await kubectl.invokeCommand("config current-context");
    if (ExecResult.failed(er)) {
        kubeChannel.showOutput(ExecResult.failureMessage(er, { whatFailed: 'Cannot get the current context' }), `Switch namespace ${namespace}`);
        vscode.window.showErrorMessage("Switch namespace failed. See Output window for more details.");
        return false;
    }
    const updateResult = await kubectl.invokeCommandWithFeedback(`config set-context ${er.stdout.trim()} --namespace="${namespace}"`,
        "Switching namespace...");
    if (ExecResult.failed(updateResult)) {
        kubeChannel.showOutput(ExecResult.failureMessage(updateResult, { whatFailed: `Failed to switch the namespace` }), `Switch namespace ${namespace}`);

        if (updateResult.resultKind === 'exec-bin-not-found') {
            kubectl.promptInstallDependencies(updateResult, `Switch namespace failed: kubectl not found`);
        } else {
            vscode.window.showErrorMessage("Switch namespace failed. See Output window for more details.");
        }
        return false;
    }
    onDidChangeNamespaceEmitter.fire(namespace);
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
export async function runAsDeployment(kubectl: Kubectl, deploymentName: string, image: string, exposedPorts: number[], env: any, debugArgs?: string): Promise<string> {
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
        ...Object.keys(env || {}).map((key) => `--env="${key}=${env[key]}"`),
        debugArgs ? debugArgs : ""
    ];

    const runResult = await kubectl.invokeCommand(runCmd.join(" "));
    if (ExecResult.failed(runResult)) {
        throw new Error(ExecResult.failureMessage(runResult, { whatFailed: `Failed to run the image "${image}" on Kubernetes` }));
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
        const er = await kubectl.invokeCommand(`get pod/${podName} --no-headers`);
        if (ExecResult.failed(er)) {
            throw new Error(ExecResult.failureMessage(er, { whatFailed: 'Failed to get pod status' }));
        }
        const status = er.stdout.split(/\s+/)[2];
        kubeChannel.showOutput(`pod/${podName} status: ${status}`);
        if (status === "Running") {
            return;
        } else if (!isTransientPodState(status)) {
            const logsResult = await kubectl.invokeCommand(`logs pod/${podName}`);
            kubeChannel.showOutput(`Failed to start the pod "${podName}". Its status is "${status}".
                Pod logs:\n${shellMessage(logsResult, "Unable to retrieve logs")}`);
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
export async function getResourceAsJson<T extends KubernetesResource | KubernetesCollection<KubernetesResource>>(kubectl: Kubectl, resourceId: string, resourceNamespace?: string): Promise<T | undefined> {
    const nsarg = resourceNamespace ? `--namespace ${resourceNamespace}` : '';
    const shellResult = await kubectl.asJson<T>(`get ${resourceId} ${nsarg} -o json`);
    if (failed(shellResult)) {
        vscode.window.showErrorMessage(shellResult.error[0]);
        return undefined;
    }
    return shellResult.result;
}

export async function createResourceFromUri(uri: vscode.Uri, kubectl: Kubectl) {
    await changeResourceFromUri(uri, kubectl, 'create', 'creating', 'created');
}

export async function deleteResourceFromUri(uri: vscode.Uri, kubectl: Kubectl) {
    const result = await vscode.window.showWarningMessage('Are you sure you want to delete this resource?', 'Delete', 'Cancel');
    if (result === 'Delete') {
        await changeResourceFromUri(uri, kubectl, 'delete', 'deleting', 'deleted');
    }
}

export async function applyResourceFromUri(uri: vscode.Uri, kubectl: Kubectl) {
    await changeResourceFromUri(uri, kubectl, 'apply', 'applying', 'applied');
}

async function changeResourceFromUri(uri: vscode.Uri, kubectl: Kubectl, command: string, verbParticiple: string, verbPast: string) {
    if (uri.scheme !== 'file') {
        vscode.window.showErrorMessage(`${uri.toString()} is not a file path.`);
        return;
    }
    const path = vscode.workspace.asRelativePath(uri);
    const result = await kubectl.invokeCommand(`${command} -f "${path}"`);
    if (ExecResult.failed(result)) {
        kubectl.reportFailure(result, { whatFailed: `Error ${verbParticiple} resource` });
    } else {
        vscode.window.showInformationMessage(`Resource ${path} ${verbPast}.`);
    }
}

export async function namespaceResources(kubectl: Kubectl, ns: string): Promise<Errorable<string[]>> {
    const arresult = await kubectl.readTable('api-resources -o wide');
    if (ExecResult.failed(arresult)) {
        return { succeeded: false, error: [ExecResult.failureMessage(arresult, {})] };
    }

    const resourceKinds = arresult.result.filter((r) => r.namespaced === 'true')
                                         .filter((r) => r.verbs.includes('list'))
                                         .map((r) => r.name);
    const resourceKindsList = resourceKinds.join(',');

    const getresult = await kubectl.invokeCommand(`get ${resourceKindsList} -o name --namespace ${ns} --ignore-not-found`);

    return ExecResult.tryMap<string[]>(getresult, (text) =>
        text.split('\n').map((s) => s.trim()).filter((s) => s.length > 0)
    );
}

export async function clusterResources(kubectl: Kubectl, verbs: string[]): Promise<Errorable<ResourceKind[]>> {
    const arresult = await kubectl.readTable('api-resources -o wide');
    if (ExecResult.failed(arresult)) {
        return { succeeded: false, error: [ExecResult.failureMessage(arresult, {})] };
    }

    const resourceKinds: ResourceKind[] = arresult.result.filter((r) => verbs.every((verb) => r.verbs.includes(verb)))
                                         .map((r) =>
                                            new ResourceKind(r.name, r.name, r.kind, r.shortnames === '' ? r.kind : r.shortnames));

    return { succeeded: true, result: resourceKinds };
}

export async function getResourceVersion(kubectl: Kubectl, resource: string): Promise<string | undefined> {
    const documentation = await kubectl.asLines(` explain ${resource}`);
    if (failed(documentation)) {
        return undefined;
    }

    const rgx = new RegExp('(?<=VERSION:\\s*)(\\S)+.*');
    for (const line of documentation.result) {
        const match = line.match(rgx);
        if (match) {
            return match[0];
        }
    }

    return undefined;
}
