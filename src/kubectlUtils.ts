import * as vscode from "vscode";
import { Kubectl } from "./kubectl";
import { kubeChannel } from "./kubeChannel";
import { sleep } from "./sleep";
import { ObjectMeta, KubernetesCollection, DataResource, Namespace, Pod, KubernetesResource, KeyValuePairs } from './kuberesources.objectmodel';
import { failed, Errorable } from "./errorable";
import { ExecResult } from "./binutilplusplus";
import { shellMessage } from "./shell";
import { ResourceKind } from "./kuberesources";
import {
    hasValidKubernetesMetadata,
    hasValidPodIdentifiers,
    INVALID_KUBERNETES_IDENTIFIER_MESSAGE,
    isValidConfigDataKey,
    isValidKubeconfigName,
    isValidKubernetesApiVersion,
    isValidDns1035Label,
    isValidKubernetesKind,
    isValidKubernetesLabelSelector,
    kubernetesLabelSelectorToString,
    isValidKubernetesResourceName,
    isValidOpaqueResourceReference,
    isValidKubernetesResourceType,
    isValidKubernetesResourceTypeList,
    isValidNamespaceName,
    sanitizeForDisplay,
    isSafeOpaqueIdentifier,
} from './utils/kubernetes-identifiers';

export interface KubectlContext {
    readonly clusterName: string;
    readonly contextName: string;
    readonly userName: string;
    readonly active: boolean;
    readonly provider: string;
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
    readonly ready: string;
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
    const config = await kubectl.readJSON<any>(["config", "view", "-o", "json"]);
    if (ExecResult.failed(config)) {
        if (options.silent) {
            console.log(ExecResult.failureMessage(config, {}));
        } else {
            kubectl.reportFailure(config, {});
        }
        return null;
    }
    if (!config.result || !hasValidKubeconfigNames(config.result)) {
        throw invalidIdentifierError();
    }
    return config.result;
}

export async function getCurrentClusterConfig(kubectl: Kubectl, options: ConfigReadOptions): Promise<ClusterConfig | undefined> {
    const kubeConfig = await getKubeconfig(kubectl, options);
    if (!kubeConfig || !kubeConfig.clusters || !kubeConfig.contexts) {
        return undefined;
    }
    const contextConfig = kubeConfig.contexts.find((context) => context.name === kubeConfig["current-context"]);
    if (!contextConfig) {
        return undefined;
    }
    const clusterConfig = kubeConfig.clusters.find((cluster) => cluster.name === contextConfig.context.cluster);
    if (!clusterConfig) {
        return undefined;
    }
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
    const clusters = kubectlConfig.clusters || [];

    // Map contexts and extract provider information
    return contexts.map((c) => {
    // Find the cluster corresponding to the context
    const cluster = clusters.find((cl) => cl.name === c.context.cluster);

    // Extract provider type from the cluster's server property if it includes "azk8ms"
    const azurePattern = /(^|\.)azmk8s\.io(?=[:\/?]|$)/i;
    const provider = azurePattern.test(cluster?.cluster?.server || '') ? 'AKS' : '';

    return {
            clusterName: c.context.cluster,
            contextName: c.name,
            userName: c.context.user,
            active: c.name === currentContext,
            provider: provider
        };
    });
}

export async function getCurrentContext(kubectl: Kubectl, options: ConfigReadOptions): Promise<KubectlContext | undefined> {
    const contexts = await getContexts(kubectl, options);
    return contexts.find((c) => c.active);
}

export async function deleteCluster(kubectl: Kubectl, context: KubectlContext): Promise<boolean> {
    if (!isValidKubeconfigName(context.clusterName) ||
        !isValidKubeconfigName(context.contextName) ||
        !isValidKubeconfigName(context.userName)) {
        reportInvalidIdentifier();
        return false;
    }
    const deleteClusterResult = await kubectl.invokeCommandWithFeedback(["config", "delete-cluster", "--", context.clusterName], "Deleting cluster...");
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

    const deleteUserResult = await kubectl.invokeCommandWithFeedback(["config", "delete-user", "--", context.userName], "Deleting user...");
    if (ExecResult.failed(deleteUserResult)) {
        const whatFailed = `Failed to remove the underlying user for context ${context.contextName} from the kubeconfig`;
        kubeChannel.showOutput(ExecResult.failureMessage(deleteUserResult, { whatFailed }));
        vscode.window.showWarningMessage(`Failed to remove the underlying user for context ${context.contextName}. See Output window for more details.`);
    }

    const deleteContextResult = await kubectl.invokeCommandWithFeedback(["config", "delete-context", "--", context.contextName], "Deleting context...");
    if (ExecResult.failed(deleteContextResult)) {
        const whatFailed = `Failed to delete the specified cluster's context ${context.contextName} from the kubeconfig`;
        kubeChannel.showOutput(ExecResult.failureMessage(deleteContextResult, { whatFailed }));
        vscode.window.showErrorMessage(`Delete ${context.contextName} failed. See Output window for more details.`);
        return false;
    }

    vscode.window.showInformationMessage(`Deleted context '${context.contextName}' and associated data from the kubeconfig.`);
    return true;
}

export async function getAsDataResource(resourceId: string, kind: string, kubectl: Kubectl): Promise<DataResource> {
    if (!isValidKubernetesResourceName(resourceId) || !isValidKubernetesResourceType(kind)) {
        throw invalidIdentifierError();
    }
    const currentNS = await currentNamespace(kubectl);

    const dataResource = await kubectl.asJson<DataResource>(["get", kind, resourceId, "-o", "json", `--namespace=${currentNS}`]);
    if (failed(dataResource)) {
        vscode.window.showErrorMessage(dataResource.error[0]);
        return {
            data: {},
            kind,
            metadata: {
                name: resourceId,
                namespace: currentNS
            }
        };
    }
    if (!dataResource.result ||
        !hasValidKubernetesMetadata((dataResource.result as { metadata?: unknown }).metadata) ||
        !hasValidDataKeys((dataResource.result as { data?: unknown }).data)) {
        throw invalidIdentifierError();
    }
    return dataResource.result;
}

export async function getAsDataResources(resource: string, kubectl: Kubectl): Promise<DataResource[]> {
    if (!isValidKubernetesResourceType(resource)) {
        reportInvalidIdentifier();
        return [];
    }
    const currentNS = await currentNamespace(kubectl);

    const resources = await kubectl.asLines(["get", resource, "--show-labels", `--namespace=${currentNS}`]);
    if (failed(resources)) {
        vscode.window.showErrorMessage(resources.error[0]);
        return [];
    }

    const rows = resources.result.map((s) => {
        const bits = s.split(/\s+/);
        if (!isSafeOpaqueIdentifier(bits[0])) {
            return undefined;
        }
        const labels = bits[bits.length -1];
        const pairs = labels.split('&');
        const labelsAsObj = pairs.reduce((obj: KeyValuePairs, data) => {
            const [k, v] = data.split('=');
            obj[k] = v;
            return obj;
        }, Object.create(null) as KeyValuePairs);
        return {
            data: {},
            kind: resource,
            metadata: {
                name: bits[0],
                namespace: currentNS,
                labels: labelsAsObj
            }
        } as DataResource;
    });

    if (rows.some((resourceInfo) => resourceInfo === undefined)) {
        reportInvalidIdentifier();
        return [];
    }
    return rows as DataResource[];
}

export async function getGlobalResources(kubectl: Kubectl, resource: string): Promise<KubernetesResource[]> {
    if (!isValidKubernetesResourceType(resource)) {
        reportInvalidIdentifier();
        return [];
    }
    const rsrcs = await kubectl.asJson<KubernetesCollection<KubernetesResource>>(["get", resource, "-o", "json"]);
    if (failed(rsrcs)) {
        vscode.window.showErrorMessage(rsrcs.error[0]);
        return [];
    }
    if (!rsrcs.result ||
        !Array.isArray(rsrcs.result.items) ||
        rsrcs.result.items.some((item) => !item || !hasValidKubernetesMetadata(item.metadata))) {
        reportInvalidIdentifier();
        return [];
    }
    return rsrcs.result.items.map((item) => {
        return {
            metadata: item.metadata,
            kind: resource
        };
    });
}

export async function getCRDTypesNumber(kubectl: Kubectl): Promise<Errorable<number>> {
    const crdExecResult = await kubectl.invokeCommand(["get", "crd", "-o", "name"]);
    if (ExecResult.failed(crdExecResult)) {
        return ExecResult.asErrorable<number>(crdExecResult, {});
    }

    return {
        succeeded: true,
        result: crdExecResult.stdout.split('\n').length
    };
}

export async function getCRDTypes(kubectl: Kubectl): Promise<ResourceKind[]> {
    // Some kubectl versions discard everything after a null/missing value within a jsonpath `range`,
    // meaning trailing newlines get omitted from the output and we can't split lines correctly.
    // For this reason, we make the newline the *first* component of the range, and ensure the value
    // which might be null (shortNames[0] in this case) is right at the end.
    // This means we end up with a blank line at the start of the output, but it's otherwise consistent.
    const jsonPath = `jsonpath={range .items[*]}{"\\n"}{.metadata.name}{" "}{.spec.names.kind}{" "}{.spec.names.singular}{" "}{.spec.names.plural}{" "}{.spec.names.shortNames[0]}{end}`;
    const crdExecResult = await kubectl.invokeCommand(["get", "crd", "-o", jsonPath]);
    if (ExecResult.failed(crdExecResult)) {
        vscode.window.showErrorMessage(ExecResult.failureMessage(crdExecResult, {}));
        return [];
    }

    const lines = crdExecResult.stdout.split('\n').filter((l) => l.length > 0);

    const resourceKinds = lines.map((line) => {
        const parts = line.replace(/\r$/, '').split(/\s+/);
        if (parts.length < 4 || parts.length > 5) {
            return undefined;
        }
        const metadataName = parts[0];
        const kind = parts[1];
        const singularName = parts[2];
        const pluralName = parts[3];
        const shortName = parts[4];
        const abbreviation = shortName || metadataName;
        if (!isValidKubernetesResourceType(metadataName) ||
            !isValidKubernetesKind(kind) ||
            !isValidDns1035Label(singularName) ||
            !isValidDns1035Label(pluralName) ||
            !(shortName ? isValidDns1035Label(shortName) : isValidKubernetesResourceType(abbreviation))) {
            return undefined;
        }
        return new ResourceKind(singularName, pluralName, kind, abbreviation, pluralName);
    });
    if (resourceKinds.some((kind) => kind === undefined)) {
        reportInvalidIdentifier();
        return [];
    }
    return resourceKinds as ResourceKind[];
}

export async function getNamespaces(kubectl: Kubectl): Promise<NamespaceInfo[]> {
    const ns = await kubectl.asJson<KubernetesCollection<Namespace>>(["get", "namespaces", "-o", "json"]);
    if (failed(ns)) {
        vscode.window.showErrorMessage(ns.error[0]);
        return [];
    }
    if (!ns.result || !Array.isArray(ns.result.items) || ns.result.items.some((item) =>
        !item || !hasValidKubernetesMetadata(item.metadata) || !isValidNamespaceName(item.metadata.name)
    )) {
        reportInvalidIdentifier();
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
    if (!isValidKubernetesResourceType(resource)) {
        reportInvalidIdentifier();
        return [];
    }
    const currentNS = await currentNamespace(kubectl);

    const shellResult = await kubectl.asJson<KubernetesCollection<any>>(["get", resource, "-o", "json", `--namespace=${currentNS}`]);
    if (failed(shellResult)) {
        vscode.window.showErrorMessage(shellResult.error[0]);
        return [];
    }
    if (!shellResult.result || !Array.isArray(shellResult.result.items) || shellResult.result.items.some((item) =>
        !item ||
        !hasValidKubernetesMetadata(item.metadata) ||
        !item.spec ||
        !isValidKubernetesLabelSelector(item.spec.selector)
    )) {
        reportInvalidIdentifier();
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
    if (ns !== 'all' && !isValidNamespaceName(ns)) {
        reportInvalidIdentifier();
        return [];
    }
    if (!isValidKubernetesLabelSelector(selector)) {
        reportInvalidIdentifier();
        return [];
    }
    const namespaceArgs = ns === 'all' ? ['--all-namespaces'] : [`--namespace=${ns}`];
    const labelSelector = kubernetesLabelSelectorToString(selector) || '';
    const labelArgs = labelSelector ? [`--selector=${labelSelector}`] : [];

    const pods = await kubectl.readTable(["get", "pods", "-o", "wide", ...namespaceArgs, ...labelArgs]);
    if (ExecResult.failed(pods)) {
        kubectl.reportFailure(pods, {});
        return [];
    }

    if (pods.result.some((item) =>
        !isValidKubernetesResourceName(item.name) ||
        (ns === 'all' && !isValidNamespaceName(item.namespace)) ||
        (item.namespace !== undefined && item.namespace !== '' && !isValidNamespaceName(item.namespace)) ||
        (item.node !== undefined && item.node !== '<none>' && !isValidKubernetesResourceName(item.node))
    )) {
        reportInvalidIdentifier();
        return [];
    }

    return pods.result.map((item) => {
        return {
            name: item.name,
            namespace: item.namespace || ns,
            nodeName: item.node,
            status: item.status,
            metadata: { name: item.name, namespace: item.namespace || ns },
            ready: item.ready
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
    const namespace = currentContext.context.namespace || "default";
    if (!isValidNamespaceName(namespace)) {
        throw invalidIdentifierError();
    }
    return namespace;
}

export async function currentNamespaceArg(kubectl: Kubectl): Promise<string> {
    return (await currentNamespaceArgs(kubectl)).join(' ');
}

function reportInvalidIdentifier(): void {
    vscode.window.showErrorMessage(INVALID_KUBERNETES_IDENTIFIER_MESSAGE);
}

function invalidIdentifierError(): Error {
    reportInvalidIdentifier();
    return new Error(INVALID_KUBERNETES_IDENTIFIER_MESSAGE);
}

function hasValidKubeconfigNames(kubeconfig: Kubeconfig): boolean {
    const currentContext = kubeconfig['current-context'];
    if (typeof currentContext !== 'string' || (currentContext !== '' && !isValidKubeconfigName(currentContext))) {
        return false;
    }

    const contexts = kubeconfig.contexts || [];
    const clusters = kubeconfig.clusters || [];
    const users = kubeconfig.users || [];
    if (!Array.isArray(contexts) || !Array.isArray(clusters) || !Array.isArray(users)) {
        return false;
    }
    const validContexts = contexts.every((context) =>
        !!context && !!context.context &&
        isValidKubeconfigName(context.name) &&
        isValidKubeconfigName(context.context.cluster) &&
        isValidKubeconfigName(context.context.user) &&
        (context.context.namespace === undefined || isValidNamespaceName(context.context.namespace))
    );
    const validClusters = clusters.every((cluster) =>
        !!cluster && !!cluster.cluster && isValidKubeconfigName(cluster.name)
    );
    const validUsers = users.every((user) => !!user && isValidKubeconfigName(user.name));
    if (!validContexts || !validClusters || !validUsers) {
        return false;
    }
    return true;
}

function hasValidDataKeys(data: unknown): boolean {
    return typeof data === 'object' && data !== null &&
        Object.keys(data).every(isValidConfigDataKey);
}

function hasValidResourceResult(value: unknown, requirePodIdentifiers: boolean): boolean {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const result = value as { items?: unknown; metadata?: unknown };
    if (result.items !== undefined) {
        return Array.isArray(result.items) && result.items.every((item) =>
            requirePodIdentifiers ? hasValidPodIdentifiers(item) :
                hasSafeOpaqueMetadata(item)
        );
    }
    return hasSafeOpaqueMetadata(value) &&
        (!requirePodIdentifiers || hasValidPodIdentifiers(value));
}

function hasSafeOpaqueMetadata(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const metadata = (value as { metadata?: { name?: unknown; namespace?: unknown } }).metadata;
    return !!metadata &&
        isSafeOpaqueIdentifier(metadata.name) &&
        (metadata.namespace === undefined || metadata.namespace === '' || isValidNamespaceName(metadata.namespace));
}

function hasValidDiscoveryResource(value: any): boolean {
    return !!value &&
        isValidKubernetesResourceType(value.name) &&
        isValidKubernetesKind(value.kind) &&
        (value.namespaced === 'true' || value.namespaced === 'false') &&
        typeof value.verbs === 'string';
}

export async function currentNamespaceArgs(kubectl: Kubectl): Promise<string[]> {
    const ns = await currentNamespace(kubectl);
    if (ns.length === 0) {
        return [];
    }
    return ['--namespace', ns];
}

export const onDidChangeNamespaceEmitter = new vscode.EventEmitter<string>();

export async function switchNamespace(kubectl: Kubectl, namespace: string): Promise<boolean> {
    if (!isValidNamespaceName(namespace)) {
        reportInvalidIdentifier();
        return false;
    }
    const er = await kubectl.invokeCommand(["config", "current-context"]);
    if (ExecResult.failed(er)) {
        kubeChannel.showOutput(ExecResult.failureMessage(er, { whatFailed: 'Cannot get the current context' }), `Switch namespace ${namespace}`);
        vscode.window.showErrorMessage("Switch namespace failed. See Output window for more details.");
        return false;
    }
    const rawContext = er.stdout.replace(/\r?\n$/, '');
    const currentContext = rawContext;
    if (!isValidKubeconfigName(currentContext)) {
        reportInvalidIdentifier();
        return false;
    }
    const updateResult = await kubectl.invokeCommandWithFeedback(["config", "set-context", `--namespace=${namespace}`, "--", currentContext],
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
export async function runAsDeployment(kubectl: Kubectl, deploymentName: string, image: string, exposedPorts: number[], env: any, debugArgs?: readonly string[]): Promise<string> {
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
        ...(imagePrefix ? [] : ["--image-pull-policy=Never"]),
        ...exposedPorts.map((port) => `--port=${port}`),
        ...Object.keys(env || {}).map((key) => `--env=${key}=${env[key]}`),
        ...(debugArgs || [])
    ];

    const runResult = await kubectl.invokeCommand(runCmd);
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
    const getResult = await kubectl.asJson<KubernetesCollection<Pod>>(["get", "pods", "-o", "json", "-l", labelQuery]);
    if (failed(getResult)) {
        throw new Error('Kubectl command failed: ' + getResult.error[0]);
    }
    if (!Array.isArray(getResult.result.items) || getResult.result.items.some((pod) => !hasValidPodIdentifiers(pod))) {
        throw invalidIdentifierError();
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
    if (!isValidKubernetesResourceName(podName)) {
        throw invalidIdentifierError();
    }
    while (true) {
        const er = await kubectl.invokeCommand(["get", `pod/${podName}`, "--no-headers"]);
        if (ExecResult.failed(er)) {
            throw new Error(ExecResult.failureMessage(er, { whatFailed: 'Failed to get pod status' }));
        }
        const status = er.stdout.split(/\s+/)[2];
        const safeStatus = sanitizeForDisplay(status);
        kubeChannel.showOutput(`pod/${podName} status: ${safeStatus}`);
        if (status === "Running") {
            return;
        } else if (!isTransientPodState(status)) {
            const logsResult = await kubectl.invokeCommand(["logs", `pod/${podName}`]);
            kubeChannel.showOutput(`Failed to start the pod "${podName}". Its status is "${safeStatus}".
                Pod logs:\n${shellMessage(logsResult, "Unable to retrieve logs")}`);
            throw new Error(`Failed to start the pod "${podName}". Its status is "${safeStatus}".`);
        }

        await sleep(1000);
    }
}

function isTransientPodState(status: string): boolean {
    return status === "ContainerCreating" || status === "Pending" || status === "Succeeded" || status.startsWith("Init");
}

/**
 * Get the specified resource information.
 *
 * @param kubectl the kubectl client.
 * @param resourceId the resource id.
 * @return the result as a json object, or undefined if errors happen.
 */
export async function getResourceAsJson<T extends KubernetesResource | KubernetesCollection<KubernetesResource>>(kubectl: Kubectl, resourceId: string, resourceNamespace?: string, silent?: boolean): Promise<T | undefined> {
    const resourceArgs = [resourceId];
    if (!isValidKubernetesResourceTypeList(resourceId) &&
        !isValidOpaqueResourceReference(resourceId)) {
        reportInvalidIdentifier();
        return undefined;
    }
    if (resourceNamespace && !isValidNamespaceName(resourceNamespace)) {
        reportInvalidIdentifier();
        return undefined;
    }
    const namespaceArgs = resourceNamespace ? ["--namespace", resourceNamespace] : [];
    const shellResult = await kubectl.asJson<T>(["get", ...resourceArgs, ...namespaceArgs, "-o", "json"]);
    if (failed(shellResult)) {
        if (!silent) {
            vscode.window.showErrorMessage(shellResult.error[0]);
        }
        return undefined;
    }
    const isPodResource = resourceId === 'pod' || resourceId === 'pods' ||
        resourceId.startsWith('pod/') || resourceId.startsWith('pods/');
    if (!hasValidResourceResult(shellResult.result, isPodResource)) {
        reportInvalidIdentifier();
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
    const result = await kubectl.invokeCommand([command, "-f", path]);
    if (ExecResult.failed(result)) {
        kubectl.reportFailure(result, { whatFailed: `Error ${verbParticiple} resource` });
    } else {
        vscode.window.showInformationMessage(`Resource ${path} ${verbPast}.`);
    }
}

export async function namespaceResources(kubectl: Kubectl, ns: string): Promise<Errorable<string[]>> {
    if (!isValidNamespaceName(ns)) {
        reportInvalidIdentifier();
        return { succeeded: false, error: [INVALID_KUBERNETES_IDENTIFIER_MESSAGE] };
    }
    const arresult = await kubectl.readTable(['api-resources', '-o', 'wide']);
    if (ExecResult.failed(arresult)) {
        return { succeeded: false, error: [ExecResult.failureMessage(arresult, {})] };
    }

    if (arresult.result.some((resource) => !hasValidDiscoveryResource(resource))) {
        reportInvalidIdentifier();
        return { succeeded: false, error: [INVALID_KUBERNETES_IDENTIFIER_MESSAGE] };
    }

    const resourceRows = arresult.result.filter((r) => r.namespaced === 'true')
                                          .filter((r) => r.verbs.includes('list'));
    const resourceKinds = resourceRows.map((r) => r.name);
    const resourceKindsList = resourceKinds.join(',');

    const getresult = await kubectl.invokeCommand(['get', resourceKindsList, '-o', 'name', '--namespace', ns, '--ignore-not-found']);

    const resources = ExecResult.tryMap<string[]>(getresult, (text) =>
        text.split('\n').map((s) => s.replace(/\r$/, '')).filter((s) => s.length > 0)
    );
    if (!failed(resources) && resources.result.some((resourceName) => !isValidOpaqueResourceReference(resourceName))) {
        reportInvalidIdentifier();
        return { succeeded: false, error: [INVALID_KUBERNETES_IDENTIFIER_MESSAGE] };
    }
    return resources;
}

export async function allResourceKinds(kubectl: Kubectl, verbs: string[]): Promise<Errorable<ResourceKind[]>> {
    const arresult = await kubectl.readTable(['api-resources', '-o', 'wide']);
    if (ExecResult.failed(arresult)) {
        return { succeeded: false, error: [ExecResult.failureMessage(arresult, {})] };
    }

    if (arresult.result.some((resource) => !hasValidDiscoveryResource(resource))) {
        reportInvalidIdentifier();
        return { succeeded: false, error: [INVALID_KUBERNETES_IDENTIFIER_MESSAGE] };
    }

    const rows = arresult.result.filter((r) => verbs.every((verb) => r.verbs.includes(verb)));
    const resourceKinds: ResourceKind[] = rows.map((r) =>
        new ResourceKind(r.name, r.name, r.kind, r.name));

    return { succeeded: true, result: resourceKinds };
}

export async function getResourceVersion(kubectl: Kubectl, resource: string): Promise<string | undefined> {
    if (!isValidKubernetesResourceType(resource)) {
        reportInvalidIdentifier();
        return undefined;
    }
    const documentation = await kubectl.asLines(['explain', resource]);
    if (failed(documentation)) {
        return undefined;
    }

    const rgx = new RegExp('(?<=VERSION:\\s*)(\\S)+.*');
    for (const line of documentation.result) {
        const match = line.match(rgx);
        if (match) {
            if (!isValidKubernetesApiVersion(match[0])) {
                reportInvalidIdentifier();
                return undefined;
            }
            return match[0];
        }
    }

    return undefined;
}
