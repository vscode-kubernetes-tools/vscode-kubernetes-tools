'use strict';

import { Kubectl } from '../../kubectl';

import { host } from '../../host';
import { findAllPods, tryFindKindNameFromEditor, FindPodsResult } from '../../extension';
import { QuickPickOptions } from 'vscode';
import * as portFinder from 'portfinder';
import { succeeded } from '../../errorable';
import * as kubectlUtils from '../../kubectlUtils';
import * as kuberesources from '../../kuberesources';

import * as kubernetes from '@kubernetes/client-node';
import { ClusterExplorerResourceNode } from '../clusterexplorer/node';
import { ExecResult } from '../../binutilplusplus';

const PORT_FORWARD_TERMINAL = 'kubectl port-forward';
const MAX_PORT_COUNT = 65535;

export interface PortMapping {
    readonly localPort?: number;
    readonly targetPort: number;
}

interface ExtractedPort {
    readonly name: string;
    readonly port: number;
}

interface ValidationResult {
    readonly valid: boolean;
    readonly error?: string;
}

interface PodFromDocument {
    readonly succeeded: true;
    readonly pod: string;
    readonly fromOpenDocument: true;
    readonly namespace?: string;
}

enum PortSpecifier {
    Required,
    AllowEmpty,
}

type PortForwardFindPodsResult = PodFromDocument | FindPodsResult;

function isFindResultFromDocument(obj: PortForwardFindPodsResult): obj is PodFromDocument {
    return (obj as PodFromDocument).fromOpenDocument;
}

/**
 * Implements port-forwarding to a target pod in the current namespace
 * @param explorerNode The treeview explorer node, if invoked from
 * tree view.
 */
export async function portForwardKubernetes(kubectl: Kubectl, explorerNode?: any): Promise<void> {
    if (explorerNode) {
        // The port forward option only appears on pod level workloads in the tree view.
        const resourceNode = explorerNode as ClusterExplorerResourceNode;
        const kind = resourceNode.kind.apiName || 'pods';
        const resourceName = resourceNode.name;
        const namespace = resourceNode.namespace || await kubectlUtils.currentNamespace(kubectl);
        return await promptAndForwardPort(kubectl, kind, resourceName, namespace);
    } else {
        let portForwardablePods: PortForwardFindPodsResult;

        try {
            portForwardablePods = await findPortForwardablePods();
        } catch (e) {
            host.showErrorMessage("Error while fetching pods for port-forward");
            throw e;
        }

        if (!portForwardablePods.succeeded) {
            host.showInformationMessage("Error while fetching pods for port-forward");
        }

        if (isFindResultFromDocument(portForwardablePods)) {
            // The pod is described by the open document. Skip asking which pod to use and go straight to port-forward.
            const podSelection = portForwardablePods.pod;
            return await promptAndForwardPort(kubectl, 'pods', podSelection, portForwardablePods.namespace);
        }

        let podSelection: string | undefined;
        const pods = portForwardablePods.pods;

        try {
            const podNames: string[] = pods.map((podObj) => podObj.metadata.name);
            podSelection = await host.showQuickPick(
                podNames,
                { placeHolder: "Select a pod to port-forward to" }
            );
        } catch (e) {
            host.showErrorMessage("Error while selecting pod for port-forward");
            throw e;
        }

        if (!podSelection) {
            host.showErrorMessage("Error while selecting pod for port-forward");
            return;
        }
        const namespace = await kubectlUtils.currentNamespace(kubectl);
        await promptAndForwardPort(kubectl, 'pods', podSelection, namespace);
    }
}

/**
 * Prompts the user on what port to port-forward to, and sets up the forwarding
 * if a valid input was provided.
 */
async function promptAndForwardPort(kubectl: Kubectl, kind: string, resourceName: string, namespace?: string): Promise<void> {
    const portMapping = await promptForPort(kubectl, kind, resourceName, namespace);
    if (portMapping.length !== 0) {
        portForwardToResource(kubectl, kind, resourceName, portMapping, namespace);
    }
}

/**
 * Given a array of containers, extract the ports to suggest to the user
 * for port forwarding.
 */
function extractContainerPorts(containers: kubernetes.V1Container[]): ExtractedPort[] {
    const ports = Array.of<ExtractedPort>();
    containers.forEach((container) => {
        if (container.ports) {
            const containerPorts = container.ports.map(({name, containerPort}) => ({
                name: name || `port-${containerPort}`,
                port: containerPort
            }));
            ports.push(...containerPorts);
        }
    });
    return ports;
}

/**
 * Given a JSON representation of a Pod, extract the ports to suggest to the user
 * for port forwarding.
 */
function extractPodPorts(podJson: string): ExtractedPort[] {
    const pod = JSON.parse(podJson) as kubernetes.V1Pod;
    const containers = pod.spec ? pod.spec.containers : [];
    return extractContainerPorts(containers);
}

/**
 * Given a JSON representation of a Service, extract the ports to suggest to the user
 * for port forwarding.
 */
function extractServicePorts(serviceJson: string): ExtractedPort[] {
    const service = JSON.parse(serviceJson) as kubernetes.V1Service;
    const k8sPorts = service.spec ? (service.spec.ports || []) : [];  // TODO: upgrade TypeScript so we can use ?.
    return k8sPorts.map((k8sport) => ({
        name: k8sport.name || `port-${k8sport.port}`,
        port: k8sport.port,
    }));
}

/**
 * Given a JSON representation of a Deployment, extract the ports to suggest to the user
 * for port forwarding.
 */
function extractDeploymentPorts(podJson: string): ExtractedPort[] {
    const deployment = JSON.parse(podJson) as kubernetes.V1Deployment;
    // TODO: upgrade TypeScript so we can use ?.
    const spec = deployment.spec ? deployment.spec.template.spec : undefined;
    const containers = spec ? spec.containers : [];
    return extractContainerPorts(containers);
}

/**
 * Prompts the user on what port to port-forward to, and validates numeric input.
 * @returns An array of PortMapping objects.
 */
async function promptForPort(kubectl: Kubectl, kind: string, resourceName: string, namespace?: string): Promise<PortMapping[]> {
    let portString: string | undefined;
    let extractedPorts = Array.of<ExtractedPort>();
    if (resourceName && kubectl) {
        const ns = namespace || 'default';
        try {
            const result = await kubectl.invokeCommand(`get ${kind} ${resourceName} --namespace ${ns} -o json`);
            if (ExecResult.failed(result)) {
                console.log(ExecResult.failureMessage(result, { whatFailed: 'Error getting ports' }));
            } else if (kind === kuberesources.allKinds.pod.apiName) {
                extractedPorts = extractPodPorts(result.stdout);
            } else if (kind === kuberesources.allKinds.service.apiName) {
                extractedPorts = extractServicePorts(result.stdout);
            } else if (kind === kuberesources.allKinds.deployment.apiName) {
                extractedPorts = extractDeploymentPorts(result.stdout);
            }
        } catch (err) {
            console.log(err);
        }
    }

    let defaultValue: string | undefined = undefined;
    if (extractedPorts.length > 0) {
        const portPairs = extractedPorts.map(({name, port}) => `${port}:${name||port}`);
        defaultValue = portPairs.join(' ');
    }

    try {
        portString = await host.showInputBox(<QuickPickOptions>{
            placeHolder: 'ex: 8888:5000 8889:5001',
            value: defaultValue,
            prompt: `Port mappings in the format LOCAL:REMOTE. Separate multiple port mappings with spaces.`,
            validateInput: (portMapping: string) => {
                const validatedPortMapping = validatePortMapping(portMapping, extractedPorts);

                if (validatedPortMapping && validatedPortMapping.error) {
                    return validatedPortMapping.error;
                }

                return undefined;
            }
        });
    } catch (e) {
        host.showErrorMessage("Could not validate on input port");
    }

    if (!portString) {
        return [];
    }
    return buildPortMapping(portString, extractedPorts);
}

/**
 * Validates the user supplied port mapping(s)
 * @param portMapping The portMapping string captured from an input field
 * @param validPorts List of valid named ports
 * @returns A ValidationResult object describing the first error found.
 */
function validatePortMapping(portMapping: string, validPorts: ExtractedPort[] = []): ValidationResult | undefined {
    const portPairs = portMapping.split(' ');
    const validationResults = portPairs.map((pair) => validatePortPair(validPorts, pair));

    return validationResults.find((result) => !result.valid);
}

/**
 * Validates a single port mapping
 * @param validPorts List of valid named ports
 * @param portPair The port pair to validate
 * @returns An error to be displayed, or undefined
 */
function validatePortPair(validPorts: ExtractedPort[], portPair: string): ValidationResult {
    const splitMapping = portPair.split(':');

    // User provided only the target port
    if (!portPair.includes(':') && isPortValid(validPorts, portPair, PortSpecifier.Required)) {
        return {
            valid: true
        };
    }

    // User provided local:target port mapping
    if (splitMapping.length > 2) {
        return {
            valid: false,
            error: `Invalid port mapping: ${portPair}`
        };
    }

    const localPort = splitMapping[0];
    const targetPort = splitMapping[1];

    if (
        isPortValid(validPorts, localPort, PortSpecifier.AllowEmpty) &&
        isPortValid(validPorts, targetPort, PortSpecifier.Required)
    ) {
        return {
            valid: true
        };
    }

    return {
        valid: false,
        error: `Invalid ports. Please enter a valid port mapping ie: 8888:5000 or 5000. Valid port range:  1 – ${MAX_PORT_COUNT}`
    };
}

/**
 * Validates if the port is a named port or withing the valid range
 * @param validPorts List of valid named ports
 * @param port The port to validate
 * @param portSpecifier Can the port be empty or zero
 * @returns Boolean identifying if the port is valid
 */
function isPortValid(validPorts: ExtractedPort[], port: string, portSpecifier: PortSpecifier): boolean {
    if (validPorts.map(({name}) => name).includes(port)) {
        return true;
    }
    if (portSpecifier === PortSpecifier.AllowEmpty && ['', '0'].includes(port)) {
        return true;
    }
    return 0 < Number(port) && Number(port) <= MAX_PORT_COUNT;
}

/**
 * Builds and returns multiple PortMapping objects
 * @param portString A validated, user provided string containing the port mappings
 * @param namedPorts List of valid named ports
 * @returns An array containing the requested PortMappings
 */
export function buildPortMapping(portString: string, namedPorts: ExtractedPort[] = []): PortMapping[] {
    const portPairs = portString.split(' ');
    return portPairs.map((pair) => buildPortPair(namedPorts, pair));
}

/**
 * Builds a single PortMapping object from the captured user input
 * @param validPorts List of valid named ports
 * @param portString The port string provided by the user
 * @returns PortMapping object
 */
function buildPortPair(validPorts: ExtractedPort[], portPair: string): PortMapping {
    // Only target port supplied.
    if (!portPair.includes(':')) {
        return {
            targetPort: buildPort(validPorts, portPair),
            localPort: undefined
        };
    }

    // Both local and target ports supplied.
    const splitString = portPair.split(':');
    const localPort = splitString[0];
    const targetPort = splitString[1];

    return {
        localPort: buildNullablePort(validPorts, localPort),
        targetPort: buildPort(validPorts, targetPort)
    };
}

/**
 * Builds a single numberic port for a PortMapping object from the captured user input allowing empty or zero value
 * @param validPorts List of valid named ports
 * @param portString The port provided by the user
 * @returns numberic port number
 */
function buildNullablePort(validPorts: ExtractedPort[], port: string): number | undefined {
    if (['', '0'].includes(port)) {
        return undefined;
    }
    return buildPort(validPorts, port);
}

/**
 * Builds a single numberic port for a PortMapping object from the captured user input
 * @param validPorts List of valid named ports
 * @param portString The port provided by the user
 * @returns numberic port number
 */
function buildPort(validPorts: ExtractedPort[], port: string): number {
    const validPort = validPorts.find(({name}) => name === port);
    if (validPort) {
        return validPort.port;
    }
    return Number(port);
}

/**
 * Returns one or all available port-forwardable pods
 * Checks the open document and returns an object describing the Pod, if it can find one
 */
async function findPortForwardablePods(): Promise<PortForwardFindPodsResult> {
    const kindFromEditor = tryFindKindNameFromEditor();

    // Find the pod type from the open editor.
    if (succeeded(kindFromEditor)) {

        // Not a pod type, so not port-forwardable, fallback to looking
        // up all pods.
        if (kindFromEditor.result.kind !== 'pods' && kindFromEditor.result.kind !== 'pod') {
            return await findAllPods();
        }

        return {
            succeeded: true,
            pod: kindFromEditor.result.resourceName,
            namespace: kindFromEditor.result.namespace,
            fromOpenDocument: true
        };
    }

    return await findAllPods() as PortForwardFindPodsResult;
}

/**
 * Invokes kubectl port-forward
 * @param podName The pod name
 * @param portMapping The PortMapping objects. Each object contains the a requested local port and an optional target port.
 * @param namespace  The namespace to use to find the pod in
 * @returns The locally bound ports that were bound
 */
export async function portForwardToPod(kubectl: Kubectl, podName: string, portMapping: PortMapping[], namespace?: string): Promise<number[]> {
    return portForwardToResource(kubectl, 'pods', podName, portMapping, namespace);
}

export async function portForwardToService(kubectl: Kubectl, serviceName: string, portMapping: PortMapping[], namespace?: string): Promise<number[]> {
    return portForwardToResource(kubectl, 'services', serviceName, portMapping, namespace);
}

export async function portForwardToDeployment(kubectl: Kubectl, name: string, portMapping: PortMapping[], namespace?: string): Promise<number[]> {
    return portForwardToResource(kubectl, 'deployments', name, portMapping, namespace);
}

async function portForwardToResource(kubectl: Kubectl, kind: string, name: string, portMapping: PortMapping[], namespace?: string): Promise<number[]> {
    const usedPortMappings: PortMapping[] = await Promise.all(portMapping.map(buildUsablePortPair));

    usedPortMappings.forEach((usedPortPair) => {
        host.showInformationMessage(`Forwarding from 127.0.0.1:${usedPortPair.localPort} -> ${kind}/${name}:${usedPortPair.targetPort}`);
    });

    const usedNamespace = namespace || 'default';
    const portPairStrings = usedPortMappings.map(
        (usedPortPair) => `${usedPortPair.localPort}:${usedPortPair.targetPort}`
    );

    kubectl.invokeInNewTerminal(`port-forward ${kind}/${name} ${portPairStrings.join(' ')} -n ${usedNamespace}`, PORT_FORWARD_TERMINAL);
    return usedPortMappings.choose((usedPortPair) => usedPortPair.localPort);
}

/**
 * Builds a 'usable' port pair, containing a local port and a target port
 * Selects a local port if only the target port is provided
 * @param portPair PortMapping object
 * @returns PortMapping object containing all requisite ports
 */
async function buildUsablePortPair(portPair: PortMapping): Promise<PortMapping> {
    const localPort = portPair.localPort;
    const targetPort = portPair.targetPort;
    let usedPort = localPort;

    if (!localPort) {
        // the port key/value is the `minimum` port to assign.
        usedPort = await portFinder.getPortPromise({
            port: 10000
        } as portFinder.PortFinderOptions);
    }

    return {
        targetPort: targetPort,
        localPort: usedPort
    };
}
