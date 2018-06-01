'use strict';

import * as vscode from 'vscode';
import * as opn from 'opn';

import { createReadStream } from 'fs';
import { resolve } from 'path';
import { fs } from '../../fs';
import { portForwardToPod, PortMapping, buildPortMapping } from './port-forward';
import { host } from '../../host';
import { shell } from '../../shell';
import { create as kubectlCreate, Kubectl } from '../../kubectl';
import { installDependencies } from '../../extension';
import { Node, KubernetesCollection, Pod } from '../../kuberesources.objectmodel';
import { failed } from '../../errorable';


const KUBE_DASHBOARD_URL = "http://localhost:8001/ui/";
const TERMINAL_NAME = "Kubernetes Dashboard";
const PROXY_OUTPUT_FILE = resolve(__dirname, 'proxy.out');

const kubectl = kubectlCreate(host, fs, shell, installDependencies);

// The instance of the terminal running Kubectl Dashboard
let terminal: vscode.Terminal;

/**
 * Determines if the selected cluster is AKS or not by examining
 * all the attached nodes for two heuristics:
 * 1. Is every node an agent?
 * 2. Is the node name prefixed with `aks-`? (TODO: identify if there's a better method for this/convince AKS team to add a label) for this.
 * @returns Boolean identifying if we think this is an AKS cluster.
 */
async function isAKSCluster (): Promise<boolean> {
    const nodes = await kubectl.asJson<KubernetesCollection<Node>>('get nodes -o json');
    if (failed(nodes)) {
        return false;
    }
    const nodeItems = nodes.result.items;
    const nodeCount = nodeItems.length;

    for (let nodeItem of nodeItems) {
        let isAKSNode = _isNodeAKS(nodeItem);

        if (!isAKSNode) {
            return false;
        }
    }

    return true;
}

function _isNodeAKS(node: Node): boolean {
    const name: string = node.metadata.name;
    const roleLabel: string = node.metadata.labels["kubernetes.io/role"];

    // Kind of a hack to determine if we're using an AKS cluster…
    const isAKSNode = name.startsWith('aks-');
    const isAgentRole = roleLabel === "agent";

    return isAKSNode && isAgentRole;
}

/**
 * Finds the name of the dashboard pod running in the kube-system namespace
 * on the cluster.
 *
 * @returns The name of the dashboard pod.
 */
async function findDashboardPod (): Promise<string> {
    const dashboardPod = await kubectl.asJson<KubernetesCollection<Pod>>(
        "get pod -n kube-system -l k8s-app=kubernetes-dashboard -o json"
    );
    if (failed(dashboardPod)) {
        return undefined;
    }
    return dashboardPod.result.items[0].metadata.name;
}

/**
 * Stopgap to open the dashboard for AKS users. We port-forward directly
 * to the kube-system dashboard pod instead of invoking `kubectl proxy`.
 */
async function openDashboardForAKSCluster (): Promise<void> {
    const dashboardPod = await findDashboardPod();

    const portMapping = buildPortMapping("9090:9090");
    const boundPort = await portForwardToPod(dashboardPod, portMapping, 'kube-system');

    setTimeout(() => {
        opn(`http://localhost:${boundPort}`);
    }, 2500);
    return;
}

/**
 * Runs `kubectl proxy` in a terminal process spawned by the extension, and opens the Kubernetes
 * dashboard in the user's preferred browser.
 */
export async function dashboardKubernetes (): Promise<void> {
    // AKS clusters are handled differently due to some intricacies
    // in the way the dashboard works between k8s versions, and between
    // providers. In an ideal world, we'd only use `kubectl proxy`, this
    // is intended as a stopgap until we can re-evaluate the implementation
    // in the future.
    const isAKS = await isAKSCluster();

    if (isAKS) {
        await openDashboardForAKSCluster();
        return;
    }

    // If we've already got a terminal instance, just open the dashboard.
    if (terminal) {
        opn(KUBE_DASHBOARD_URL);
        return;
    }

    let outputExists;

    try {
        outputExists = await fs.existsAsync(PROXY_OUTPUT_FILE);
        if (!outputExists) {
            await fs.openAsync(PROXY_OUTPUT_FILE, 'w+');
        }
    } catch (e) {
        vscode.window.showErrorMessage("Something went wrong when ensuring the Kubernetes API Proxy output stream existed");
        return;
    }

    // Read kubectl proxy's stdout as a stream.
    const proxyStream = createReadStream(
        PROXY_OUTPUT_FILE,
        {encoding: 'utf8'}
    ).on('data', onStreamData);

    // stdout is also written to a file via `tee`. We read this file as a stream
    // to listen for when the server is ready.
    await kubectl.invokeInNewTerminal('proxy', TERMINAL_NAME, onClosedTerminal, `tee ${PROXY_OUTPUT_FILE}`);
}

/**
 * Called when the terminal window is closed by the user.
 * @param proxyTerminal
 */
const onClosedTerminal = async (proxyTerminal: vscode.Terminal) => {
    // Make sure we only dispose when it's *our* terminal we want gone.
    if (proxyTerminal.name !== TERMINAL_NAME) {
        return;
    }

    terminal = null;
    console.log("Closing Kubernetes API Proxy");

    try {
        await fs.unlinkAsync(PROXY_OUTPUT_FILE);
        console.log('Kubernetes API Proxy stream removed');
    } catch (e) {
        console.log('Could not remove Kubernetes API Proxy stream');
    }
};

/**
 * Callback to read data written to the Kubernetes API Proxy output stream.
 * @param data
 */
const onStreamData = (data: string) => {
    // Everything's alright…
    if (data.startsWith("Starting to serve")) {
        // Let the proxy warm up a bit… otherwise we might hit a browser's error page.
        setTimeout(() => {
            opn(KUBE_DASHBOARD_URL);
        }, 2500);

        vscode.window.showInformationMessage(`Kubernetes Dashboard running at ${KUBE_DASHBOARD_URL}`);
        return;
    }

    // Maybe we've bound to the port already outside of the extension?
    vscode.window.showErrorMessage("Could not start the Kubernetes Dashboard. Is it already running?");
    terminal.dispose();
};