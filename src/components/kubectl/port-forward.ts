'use strict';

import { create as kubectlCreate, Kubectl } from '../../kubectl';

import { fs } from '../../fs';
import { shell } from '../../shell';
import { host } from '../../host';
import { findAllPods, tryFindKindNameFromEditor, FindPodsResult } from '../../extension';
import { QuickPickOptions } from 'vscode';
import * as portFinder from 'portfinder';

const kubectl = kubectlCreate(host, fs, shell);
const PORT_FORWARD_TERMINAL = 'kubectl port-forward';
const MAX_PORT_COUNT = 65535;

export interface PortMapping {
    localPort?: number;
    targetPort: number;
}

interface PortForwardFindPodsResult extends FindPodsResult  {
    readonly fromOpenDocument?: boolean;
}

/**
 * Implements port-forwarding to a target pod in the `default` namespace.
 * @param explorerNode The treeview explorer node, if invoked from
 * tree view.
 */
export async function portForwardKubernetes (explorerNode?: any): Promise<void> {
    if (explorerNode) {
        // The port forward option only appears on pod level workloads in the tree view.
        const podName = explorerNode.id;
        const portMapping = await promptForPort(podName);
        portForwardToPod(podName, portMapping);
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

        let pods = portForwardablePods.pods;

        if (portForwardablePods.fromOpenDocument && pods.length === 1) {
            // The pod is described by the open document. Skip asking which pod to use and go straight to port-forward.
            const podSelection = portForwardablePods[0];
            const portMapping = await promptForPort(podSelection);
            portForwardToPod(podSelection, portMapping);
            return;
        }

        let podSelection;

        try {
            const podNames:string[] = pods.map((podObj) => podObj.metadata.name);
            podSelection = await host.showQuickPick(
                podNames,
                { placeHolder: "Select a pod to port-forward to" }
            );
        } catch (e) {
            host.showErrorMessage("Error while selecting pod for port-forward");
            throw e;
        }

        if (podSelection === undefined) {
            host.showErrorMessage("Error while selecting pod for port-forward");
            return;
        }

        const portMapping = await promptForPort(podSelection);
        portForwardToPod(podSelection, portMapping);
    }
}

/**
 * Given a pod name, prompts the user on what port to port-forward to, and validates numeric input.
 * @param podSelection The pod to port-forward to.
 */
async function promptForPort (podSelection: string): Promise<PortMapping> {
    let portString: string;

    try {
        portString = await host.showInputBox(<QuickPickOptions>{
            placeHolder: "ex: 8888:5000, for a specific port mapping or 5000 to pick a random local port",
            prompt: `Enter the colon (':') seperated local port to remote port mapping you'd like to port forward.`,
            validateInput: (portMapping: string) => {
                return validatePortMapping(portMapping);
            }
        });
    } catch (e) {
        host.showErrorMessage("Could not validate on input port");
    }

    return buildPortMapping(portString);
}

/**
 * Validates the user supplied port mapping.
 * @param portMapping The portMapping string captured from an input field.
 * @returns An error string to be displayed, or undefined.
 */
function validatePortMapping (portMapping: string): string {
    let localPort, targetPort;
    let splitMapping = portMapping.split(':');

    // User provided only the target port
    if (!portMapping.includes(':') && Number(portMapping)) {
        return undefined;
    }

    // User provided local:target port mapping
    if (splitMapping.length > 2) {
        return 'Invalid port mapping.';
    }

    localPort = splitMapping[0];
    targetPort = splitMapping[1];

    if (
        Number(localPort) &&
        Number(localPort) <= MAX_PORT_COUNT &&
        Number(targetPort) &&
        Number(targetPort) <= MAX_PORT_COUNT
    ) {
        return undefined;
    }

    return `Invalid ports. Please enter a valid port mapping ie: 8888:5000 or 5000. Valid port range:  1 – ${MAX_PORT_COUNT}`;
}

/**
 * Builds a PortMapping object from the captured user input.
 * @param portString The port string provided by the user.
 * @returns PortMapping object
 */
export function buildPortMapping (portString: string): PortMapping {
    // Only target port supplied.
    if (!portString.includes(':')) {
        return <PortMapping> {
            targetPort: Number(portString),
            localPort: undefined
        };
    }

    // Both local and target ports supplied.
    const splitString = portString.split(':');
    const localPort = splitString[0];
    const targetPort = splitString[1];

    return <PortMapping> {
        localPort: Number(localPort),
        targetPort: Number(targetPort)
    };
}

/**
 * Returns one or all available port-forwardable pods.
 * Checks the open document and returns a pod name, if it can find one.
 */
async function findPortForwardablePods () : Promise<PortForwardFindPodsResult> {
    let kindFromEditor = tryFindKindNameFromEditor();
    let kind, podName;

    // Find the pod type from the open editor.
    if (kindFromEditor !== null) {
        let parts = kindFromEditor.split('/');
        kind = parts[0];
        podName = parts[1];

        // Not a pod type, so not port-forwardable, fallback to looking
        // up all pods.
        if (kind !== 'pods') {
            return await findAllPods();
        }

        return <PortForwardFindPodsResult>{
            succeeded: true,
            pods: [podName],
            fromOpenDocument: true
        };
    }

    return await findAllPods() as PortForwardFindPodsResult;
}

/**
 * Invokes kubectl port-forward.
 * @param podName The pod name.
 * @param portMapping The PortMapping object. Provides the local and target ports.
 * @param namespace  The namespace to use to find the pod in.
 * @returns The locally bound port that was used.
 */
export async function portForwardToPod (podName: string, portMapping: PortMapping, namespace?: string) : Promise<number> {
    const localPort = portMapping.localPort;
    const targetPort = portMapping.targetPort;
    let usedPort = localPort;

    console.log(`port forwarding to pod ${podName} at port ${targetPort}`);

    if (!localPort) {
        // the port key/value is the `minimum` port to assign.
        usedPort = await portFinder.getPortPromise({
            port: 10000
        } as portFinder.PortFinderOptions);
    }

    let usedNamespace = namespace === undefined ? 'default' : namespace;

    kubectl.invokeInTerminal(`port-forward ${podName} ${usedPort}:${targetPort} -n ${usedNamespace}`, PORT_FORWARD_TERMINAL);
    host.showInformationMessage(`Forwarding from 127.0.0.1:${usedPort} -> ${podName}:${targetPort}`);

    return usedPort;
}