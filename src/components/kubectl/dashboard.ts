'use strict';

import * as vscode from 'vscode';
import * as browser from '../platform/browser';

import { portForwardToPod, buildPortMapping } from './port-forward';
import { proxy, ProxySession } from './proxy';
import { Kubectl } from '../../kubectl';
import { Node, KubernetesCollection, Pod } from '../../kuberesources.objectmodel';
import { failed } from '../../errorable';

const KUBE_DASHBOARD_URL = "http://localhost:8001/ui/";

let proxySession: ProxySession | undefined;

export function disposeDashboardProxy(): void {
    proxySession?.dispose();
    proxySession = undefined;
}

interface DashboardPodInfo {
    readonly name: string;
    readonly port: number;
    readonly scheme: string;
}

/**
 * Determines if the selected cluster is AKS or not by examining
 * all the attached nodes for two heuristics:
 * 1. Is every node an agent?
 * 2. Is the node name prefixed with `aks-`? (TODO: identify if there's a better method for this/convince AKS team to add a label) for this.
 * @returns Boolean identifying if we think this is an AKS cluster.
 */
async function isAKSCluster (kubectl: Kubectl): Promise<boolean> {
    const nodes = await kubectl.asJson<KubernetesCollection<Node>>(['get', 'nodes', '-o', 'json']);
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
        ['get', 'pod', '-n', 'kube-system', '-l', 'k8s-app=kubernetes-dashboard', '-o', 'json']
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
 * Runs `kubectl proxy` and opens the Kubernetes dashboard in the user's preferred browser.
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

    disposeDashboardProxy();

    const proxyResult = await proxy(kubectl, 8001);
    if (failed(proxyResult)) {
        vscode.window.showErrorMessage("Could not start the Kubernetes Dashboard. Is it already running?");
        return;
    }

    proxySession = proxyResult.result;
    browser.open(KUBE_DASHBOARD_URL);
    vscode.window.showInformationMessage(`Kubernetes Dashboard running at ${KUBE_DASHBOARD_URL}`);
}
