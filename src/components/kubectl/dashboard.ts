import * as vscode from 'vscode';
import * as browser from '../platform/browser';
import { Kubectl } from '../../kubectl';
import { Node, KubernetesCollection, Pod } from '../../kuberesources.objectmodel';
import { failed } from '../../errorable';
import { isValidPodName } from './pod-commands';
import { proxy, ProxySession, startForwardingProcess, proxyLifecycleRevision } from './proxy';

interface DashboardSession { readonly process: ProxySession; readonly url: string; }
const dashboards = new WeakMap<Kubectl, Promise<DashboardSession | undefined>>();

export function dashboardPodInfo(pod: Pod | undefined): { name: string; port: number; scheme: string } | undefined {
    const probe = pod?.spec?.containers?.[0]?.livenessProbe?.httpGet;
    if (!pod || !isValidPodName(pod.metadata?.name) || !probe ||
        !Number.isInteger(probe.port) || probe.port < 1 || probe.port > 65535 ||
        (probe.scheme !== undefined && probe.scheme !== 'HTTP' && probe.scheme !== 'HTTPS')) {
        return undefined;
    }
    return { name: pod.metadata.name, port: probe.port, scheme: (probe.scheme || 'HTTP').toLowerCase() };
}

async function startDashboard(kubectl: Kubectl): Promise<DashboardSession | undefined> {
    const revision = proxyLifecycleRevision();
    const nodes = await kubectl.asJsonArgs<KubernetesCollection<Node>>(['get', 'nodes', '-o', 'json']);
    if (revision !== proxyLifecycleRevision()) { return undefined; }
    // Node discovery is only an AKS heuristic. Namespace-scoped users may not
    // have permission to list nodes but can still use the normal proxy path.
    const items = failed(nodes) ? [] : nodes.result?.items;
    if (!Array.isArray(items)) {
        await vscode.window.showErrorMessage('The Kubernetes endpoint returned invalid node metadata.');
        return undefined;
    }
    const isAKS = items.length > 0 && items.every((node) =>
        typeof node?.metadata?.name === 'string' && node.metadata.name.startsWith('aks-') &&
        node.metadata.labels?.['kubernetes.io/role'] === 'agent');
    let process;
    let scheme = 'http';
    if (isAKS) {
        const pods = await kubectl.asJsonArgs<KubernetesCollection<Pod>>([
            'get', 'pods', '--namespace', 'kube-system', '--selector', 'k8s-app=kubernetes-dashboard', '-o', 'json',
        ]);
        if (revision !== proxyLifecycleRevision()) { return undefined; }
        const info = !failed(pods) && Array.isArray(pods.result?.items) ? dashboardPodInfo(pods.result.items[0]) : undefined;
        if (!info) {
            await vscode.window.showErrorMessage('Could not find a dashboard pod with a valid HTTP port.');
            return undefined;
        }
        scheme = info.scheme;
        process = await startForwardingProcess(kubectl, [
            'port-forward', `pod/${info.name}`, '--namespace', 'kube-system', '--address=127.0.0.1', `0:${info.port}`,
        ], /(?:^|\n)Forwarding from 127\.0\.0\.1:(\d+) -> \d+\r?\n/);
    } else {
        process = await proxy(kubectl, 'random');
    }
    if (failed(process)) {
        await vscode.window.showErrorMessage(`Could not start Kubernetes Dashboard: ${process.error.join(' ')}`);
        return undefined;
    }
    if (revision !== proxyLifecycleRevision()) {
        process.result.dispose();
        return undefined;
    }
    return { process: process.result, url: `${scheme}://127.0.0.1:${process.result.port}${isAKS ? '' : '/ui/'}` };
}

export async function dashboardKubernetes(kubectl: Kubectl): Promise<void> {
    const revision = proxyLifecycleRevision();
    let pending = dashboards.get(kubectl);
    if (pending) {
        const existing = await pending;
        if (revision !== proxyLifecycleRevision()) { return; }
        if (!existing || !existing.process.isActive) {
            if (dashboards.get(kubectl) === pending) { dashboards.delete(kubectl); }
            pending = dashboards.get(kubectl);
        }
    }
    if (!pending) {
        pending = startDashboard(kubectl);
        dashboards.set(kubectl, pending);
    }
    const dashboard = await pending;
    if (revision !== proxyLifecycleRevision()) { return; }
    if (!dashboard || !dashboard.process.isActive) {
        if (dashboards.get(kubectl) === pending) { dashboards.delete(kubectl); }
        return;
    }
    void dashboard.process.completed.then(() => {
        if (dashboards.get(kubectl) === pending) { dashboards.delete(kubectl); }
    });
    browser.open(dashboard.url);
    await vscode.window.showInformationMessage(`Kubernetes Dashboard running at ${dashboard.url}`);
}
