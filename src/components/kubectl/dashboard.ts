'use strict';

import * as vscode from 'vscode';
import * as browser from '../platform/browser';
import { resolve } from 'path';
import { fs } from '../../fs';
import { portForwardToPod, buildPortMapping } from './port-forward';
import { Kubectl } from '../../kubectl';
import { Node, KubernetesCollection, Pod } from '../../kuberesources.objectmodel';
import { failed } from '../../errorable';

const DEFAULT_DASHBOARD_URL = "http://localhost:8001/ui/";
const DASHBOARD_URL_KEY = "vs-kubernetes.dashboard-url";
const DASHBOARD_AUTO_OPEN_KEY = "vs-kubernetes.dashboard-auto-open-in-browser";
const DEFAULT_DASHBOARD_AUTO_OPEN = false;
const TERMINAL_NAME = "Kubernetes Dashboard";
const PROXY_OUTPUT_FILE = resolve(__dirname, "proxy.out");

// The instance of the terminal running Kubectl Dashboard
let terminal: vscode.Terminal | null = null;
let dashboardMessageTriggered = false;
let proxyReadyCheckInterval: NodeJS.Timeout | null = null;
let proxyReadyStartedAt: number | null = null;
const PROXY_READY_TIMEOUT_MS = 15000;

interface DashboardPodInfo {
    readonly name: string;
    readonly port: number;
    readonly scheme: string;
}

function getDashboardUrl(): string {
    const configValue =
        vscode.workspace.getConfiguration("vs-kubernetes")[DASHBOARD_URL_KEY];
    if (typeof configValue === "string" && configValue.trim().length > 0) {
        return configValue;
    }
    return DEFAULT_DASHBOARD_URL;
}

function getAutoOpenDashboard(): boolean {
    const configValue =
        vscode.workspace.getConfiguration("vs-kubernetes")[DASHBOARD_AUTO_OPEN_KEY];
    if (typeof configValue === "boolean") {
        return configValue;
    }
    return DEFAULT_DASHBOARD_AUTO_OPEN;
}



function findDashboardTerminal(): vscode.Terminal | null {
    return (
        vscode.window.terminals.find((t) => t.name === TERMINAL_NAME) || null
    );
}

function openDashboardOnce(): void {
    if (!getAutoOpenDashboard()) {
        return;
    }
    browser.open(getDashboardUrl());
}

function showDashboardReadyMessage(): void {
    if (dashboardMessageTriggered && getAutoOpenDashboard()) {
        return;
    }
    dashboardMessageTriggered = true;
    const dashboardUrl = getDashboardUrl();
    if (!getAutoOpenDashboard()) {
        const openItem: vscode.MessageItem = { title: 'Open Dashboard' };
            vscode.window
                .showInformationMessage("Kubernetes Dashboard is running.", openItem)
                .then((selection) => {
                    if (selection && selection.title === 'Open Dashboard') {
                        browser.open(dashboardUrl);
                    }
                });
    } else {
        vscode.window.showInformationMessage(
            `Kubernetes Dashboard is running at ${dashboardUrl}`,
        );
    }
  
}

function startProxyReadyWatch(): void {
    stopProxyReadyWatch();
    proxyReadyStartedAt = Date.now();
    proxyReadyCheckInterval = setInterval(async () => {
        if (dashboardMessageTriggered) {
            stopProxyReadyWatch();
            return;
        }
        if (proxyReadyStartedAt && Date.now() - proxyReadyStartedAt > PROXY_READY_TIMEOUT_MS) {
            stopProxyReadyWatch();
            vscode.window.showErrorMessage(
                "Could not start the Kubernetes Dashboard. Is it already running?",
            );
            if (terminal) {
                terminal.dispose();
            }
            return;
        }
        try {
            const output = await fs.readTextFile(PROXY_OUTPUT_FILE);
            if (output.includes("Starting to serve")) {
                openDashboardOnce();
                showDashboardReadyMessage();
                stopProxyReadyWatch();
            }
        } catch (e) {
            // Ignore transient read errors while the file is being created/written.
        }
    }, 500);
}

function stopProxyReadyWatch(): void {
    if (proxyReadyCheckInterval) {
        clearInterval(proxyReadyCheckInterval);
        proxyReadyCheckInterval = null;
    }
    proxyReadyStartedAt = null;
}

/**
 * Determines if the selected cluster is AKS or not by examining
 * all the attached nodes for two heuristics:
 * 1. Is every node an agent?
 * 2. Is the node name prefixed with `aks-`? (TODO: identify if there's a better method for this/convince AKS team to add a label) for this.
 * @returns Boolean identifying if we think this is an AKS cluster.
 */
async function isAKSCluster (kubectl: Kubectl): Promise<boolean> {
    const nodes = await kubectl.asJson<KubernetesCollection<Node>>('get nodes -o json');
    if (failed(nodes)) {
        return false;
    }

    const nodeItems = nodes.result.items;
    for (const nodeItem of nodeItems) {
        const isAKSNode = isNodeAKS(nodeItem);

        if (!isAKSNode) {
            return false;
        }
    }

   return true;
}

function isNodeAKS(node: Node): boolean {
    const name: string = node.metadata.name;
    const roleLabel: string = node.metadata.labels ? node.metadata.labels["kubernetes.io/role"] : '';

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
async function findDashboardPod(kubectl: Kubectl): Promise<DashboardPodInfo | undefined> {
    const dashboardPod = await kubectl.asJson<KubernetesCollection<Pod>>(
        "get pod -n kube-system -l k8s-app=kubernetes-dashboard -o json"
    );
    if (failed(dashboardPod)) {
        return undefined;
    }
    const livenessProbeHttpGet = dashboardPod.result.items[0].spec.containers[0].livenessProbe!.httpGet;
    return { name: dashboardPod.result.items[0].metadata.name, port: livenessProbeHttpGet.port, scheme: livenessProbeHttpGet.scheme };
}

/**
 * Stopgap to open the dashboard for AKS users. We port-forward directly
 * to the kube-system dashboard pod instead of invoking `kubectl proxy`.
 */
async function openDashboardForAKSCluster (kubectl: Kubectl): Promise<void> {
    const dashboardPod = await findDashboardPod(kubectl);
    if (!dashboardPod) {
        return;
    }

    // Local port 9090 could be bound to something else.
    const portMapping = buildPortMapping(String(dashboardPod.port));
    const boundPort = await portForwardToPod(kubectl, dashboardPod.name, portMapping, 'kube-system');

    setTimeout(() => {
        browser.open(`${dashboardPod.scheme}://localhost:${boundPort[0]}`);
    }, 2500);
    return;
}

/**
 * Runs `kubectl proxy` in a terminal process spawned by the extension, and opens the Kubernetes
 * dashboard in the user's preferred browser.
 */
export async function dashboardKubernetes (kubectl: Kubectl): Promise<void> {
    // AKS clusters are handled differently due to some intricacies
    // in the way the dashboard works between k8s versions, and between
    // providers. In an ideal world, we'd only use `kubectl proxy`, this
    // is intended as a stopgap until we can re-evaluate the implementation
    // in the future.
    const isAKS = await isAKSCluster(kubectl);

    if (isAKS) {
        await openDashboardForAKSCluster(kubectl);
        return;
    }

    // If we've already got a terminal instance, just open the dashboard.
    if (!terminal) {
        terminal = findDashboardTerminal();
    }
    if (terminal) {
        openDashboardOnce();
        showDashboardReadyMessage();
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

    // stdout is also written to a file via `tee`. We read this file as a stream
    // to listen for when the server is ready.
    await kubectl.invokeInNewTerminal(
        "proxy",
        TERMINAL_NAME,
        onClosedTerminal,
        `tee ${PROXY_OUTPUT_FILE}`,
    );


    terminal = findDashboardTerminal();
    startProxyReadyWatch();
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
    dashboardMessageTriggered = false;
    stopProxyReadyWatch();
    console.log("Closing Kubernetes API Proxy");

    try {
        await fs.unlinkAsync(PROXY_OUTPUT_FILE);
        console.log('Kubernetes API Proxy stream removed');
    } catch (e) {
        console.log('Could not remove Kubernetes API Proxy stream');
    }
};