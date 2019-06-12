'use strict';

import { Kubectl } from '../../kubectl';

import { host } from '../../host';
import { findAllPods, tryFindKindNameFromEditor, FindPodsResult } from '../../extension';
import { QuickPickOptions } from 'vscode';
import * as portFinder from 'portfinder';
import { succeeded } from '../../errorable';
import * as kubectlUtils from '../../kubectlUtils';
import * as kuberesources from '../../kuberesources';
import { ResourceNode } from '../../explorer';

import * as kubernetes from '@kubernetes/client-node';

const PORT_FORWARD_TERMINAL = 'kubectl port-forward';
const MAX_PORT_COUNT = 65535;

export interface PortMapping {
    readonly localPort?: number;
    readonly targetPort: number;
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
        const resourceNode = explorerNode as ResourceNode;
        const podName = resourceNode.id;
        const namespace = resourceNode.namespace || await kubectlUtils.currentNamespace(kubectl);
        const portMapping = await promptForPort(kubectl, podName, namespace);
        if (portMapping.length !== 0) {
            if (explorerNode.kind === kuberesources.allKinds.pod) {
                portForwardToPod(kubectl, podName, portMapping, namespace);
            } else if (explorerNode.kind === kuberesources.allKinds.service) {
                portForwardToService(kubectl, resourceNode.id, portMapping, namespace);
            } else if (explorerNode.kind === kuberesources.allKinds.deployment) {
                portForwardToDeployment(kubectl, resourceNode.id, portMapping, namespace);
            }
        }
        return;
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
            const portMapping = await promptForPort(kubectl, podSelection, portForwardablePods.namespace);
            if (portMapping.length !== 0) {
                portForwardToPod(kubectl, podSelection, portMapping, portForwardablePods.namespace);
            }
            return;
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
        const portMapping = await promptForPort(kubectl, podSelection, namespace);
        if (portMapping.length !== 0) {
            portForwardToPod(kubectl, podSelection, portMapping, namespace);
        }
    }
}

/**
 * Given a JSON representation of a Pod, extract the ports to suggest to the user for
 * for port forwarding.
 */
function extractPodPorts(podJson: string): string | undefined {
    const pod = JSON.parse(podJson) as kubernetes.V1Pod;
    const containers = pod.spec.containers;
    const ports = Array.of<number>();
    containers.forEach((container) => {
        if (container.ports) {
            const containerPorts = container.ports.map((port) => port.containerPort);
            ports.push(...containerPorts);
        }
    });
    if (ports.length > 0) {
        const portPairs = ports.map((port) => `${port}:${port}`);
        return portPairs.join(' ');
    }
    return;
}

/**
 * Prompts the user on what port to port-forward to, and validates numeric input.
 * @returns An array of PortMapping objects.
 */
async function promptForPort(kubectl?: Kubectl, podName?: string, namespace?: string): Promise<PortMapping[]> {
    let portString: string | undefined;
    let defaultValue: string | undefined = undefined;
    if (podName && kubectl) {
        const ns = namespace || 'default';
        try {
            const result = await kubectl.invokeAsync(`get pods ${podName} --namespace ${ns} -o json`);
            if (result) {
                if (result.code === 0) {
                    defaultValue = extractPodPorts(result.stdout);
                } else {
                    console.log(`Error getting ports: ${result.stderr}`);
                }
            }
        } catch (err) {
            console.log(err);
        }
    }

    try {
        portString = await host.showInputBox(<QuickPickOptions>{
            placeHolder: 'ex: 8888:5000 8889:5001',
            value: defaultValue,
            prompt: `Port mappings in the format LOCAL:REMOTE. Separate multiple port mappings with spaces.`,
            validateInput: (portMapping: string) => {
                const validatedPortMapping = validatePortMapping(portMapping);

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
    return buildPortMapping(portString);
}

/**
 * Validates the user supplied port mapping(s)
 * @param portMapping The portMapping string captured from an input field
 * @returns A ValidationResult object describing the first error found.
 */
function validatePortMapping(portMapping: string): ValidationResult | undefined {
    const portPairs = portMapping.split(' ');
    const validationResults: ValidationResult[] = portPairs.map(validatePortPair);

    return validationResults.find((result) => !result.valid);
}

/**
 * Validates a single port mapping
 * @param portPair The port pair to validate
 * @returns An error to be displayed, or undefined
 */
function validatePortPair(portPair: string): ValidationResult {
    let localPort, targetPort;
    const splitMapping = portPair.split(':');

    // User provided only the target port
    if (!portPair.includes(':') && Number(portPair)) {
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

    localPort = splitMapping[0];
    targetPort = splitMapping[1];

    if (
        Number(localPort) &&
        Number(localPort) <= MAX_PORT_COUNT &&
        Number(targetPort) &&
        Number(targetPort) <= MAX_PORT_COUNT
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
 * Builds and returns multiple PortMapping objects
 * @param portString A validated, user provided string containing the port mappings
 * @returns An array containing the requested PortMappings
 */
export function buildPortMapping(portString: string): PortMapping[] {
    const portPairs = portString.split(' ');
    return portPairs.map(buildPortPair);
}

/**
 * Builds a single PortMapping object from the captured user input
 * @param portString The port string provided by the user
 * @returns PortMapping object
 */
function buildPortPair(portPair: string): PortMapping {
    // Only target port supplied.
    if (!portPair.includes(':')) {
        return {
            targetPort: Number(portPair),
            localPort: undefined
        };
    }

    // Both local and target ports supplied.
    const splitString = portPair.split(':');
    const localPort = splitString[0];
    const targetPort = splitString[1];

    return {
        localPort: Number(localPort),
        targetPort: Number(targetPort)
    };
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
