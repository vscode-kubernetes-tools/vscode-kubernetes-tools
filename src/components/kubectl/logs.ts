import * as vscode from 'vscode';
import { Kubectl } from '../../kubectl';
import { getContainersForResource, PodSummary, quickPickKindName } from '../../extension';
import { Container, isPod } from '../../kuberesources.objectmodel';
import * as kuberesources from '../../kuberesources';
import * as yaml from 'js-yaml';
import * as kubectlUtils from '../../kubectlUtils';
import { LogsPanel } from '../../components/logs/logsWebview';
import { ContainerContainer } from '../../utils/containercontainer';
import { ClusterExplorerResourceNode } from '../clusterexplorer/node';
import { ExecResult } from '../../binutilplusplus';
import { LogsDestination } from '../config/config';
import { logsArgs } from './log-command';
import { Subject } from 'rxjs';
import { StringDecoder } from 'string_decoder';

export enum LogsDisplayMode {
    Show,
    Follow
}

/**
 * Fetches logs for a Pod. Handles use cases for fetching pods
 * from an open document, or from the current namespace.
 */
export async function logsKubernetes(
    kubectl: Kubectl,
    explorerNode: ClusterExplorerResourceNode | undefined
) {
    if (explorerNode) {
        return await getLogsForExplorerNode(kubectl, explorerNode);
    }

    return logsForPod(kubectl);
}

/**
 * Fetch logs from a Pod, when selected from the Explorer.
 */
async function getLogsForExplorerNode(
    kubectl: Kubectl,
    explorerNode: ClusterExplorerResourceNode
) {
    const resource = ContainerContainer.fromNode(explorerNode);
    if (!resource) {
        return;
    }

    return getLogsForResource(kubectl, resource);
}

/**
 * Fetches logs for a pod. If there are more than one containers,
 * prompts the user for which container to fetch logs for.
 */
async function getLogsForPod(kubectl: Kubectl, pod: PodSummary) {
    const resource = {
        kindName: `pod/${pod.name}`,
        namespace: pod.namespace,
        containers: pod.spec ? pod.spec.containers : undefined,
        containersQueryPath: '.spec'
    };
    return getLogsForResource(kubectl, resource);
}

async function getLogsForResource(kubectl: Kubectl, resource: ContainerContainer) {
    if (!resource) {
        vscode.window.showErrorMessage('Can\'t find the resource to get logs from!');
        return;
    }

    const containers = await getContainersForResource(resource);
    if (!containers) {
        return;
    }

    showLogsView(kubectl, resource, containers);
}

/**
 * Gets the logs for a container in a provided pod, in a provided namespace, in a provided container.
 */
function showLogsView(
    kubectl: Kubectl,
    containerResource: ContainerContainer,
    containers: Container[]
) {
    LogsPanel.createOrShow('Loading...', containerResource.namespace, containerResource.kindName, containers, kubectl);
}

export async function getLogsForContainer(
    panel: LogsPanel,
    kubectl: Kubectl,
    namespace: string | undefined,
    kindName: string,
    containerName: string,
    displayMode: LogsDisplayMode,
    showTimestamp: boolean,
    since: string,
    tail: number,
    destination: LogsDestination
) {
    const args = logsArgs({ namespace, resource: kindName, container: containerName,
        follow: displayMode === LogsDisplayMode.Follow, timestamps: showTimestamp, since, tail });
    if (!args || (displayMode !== LogsDisplayMode.Follow && displayMode !== LogsDisplayMode.Show) ||
        (destination !== LogsDestination.Terminal && destination !== LogsDestination.Webview)) {
        await vscode.window.showErrorMessage('Invalid Kubernetes log options.');
        return;
    }

    if (destination === LogsDestination.Terminal) {
        panel.deleteAppendContentProcess();
        await kubectl.invokeArgsInOutputTerminal(args, `Logs: ${kindName}${containerName ? ('/' + containerName) : ''}`);
        return;
    }

    let cancelled = false;
    let stopChild: (() => void) | undefined;
    const lease = { lines: new Subject<string>(), terminate: () => { cancelled = true; stopChild?.(); } };
    panel.setAppendContentProcess(lease);
    try {
        if (displayMode === LogsDisplayMode.Follow) {
            const result = await kubectl.spawnCommandArgs(args);
            if (result.resultKind !== 'exec-child-process-started') {
                if (!cancelled) { await kubectl.reportFailure(result, { whatFailed: 'Follow logs failed' }); }
                return;
            }
            const child = result.childProcess;
            let closed = false;
            let timer: NodeJS.Timeout | undefined;
            const decoder = new StringDecoder('utf8');
            let stderr = '';
            stopChild = () => {
                if (closed || timer) { return; }
                if (child.exitCode === null && child.signalCode === null) { child.kill(); }
                timer = setTimeout(() => {
                    if (!closed) {
                        if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); }
                        child.stdout?.destroy(); child.stderr?.destroy();
                    }
                }, 2000);
                timer.unref();
            };
            child.stdin?.end();
            child.stdout?.on('data', (chunk: Buffer) => { if (!cancelled) { panel.addContent(decoder.write(chunk)); } });
            child.stderr?.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(-8192); });
            child.on('error', (error) => { if (!cancelled) { void vscode.window.showErrorMessage(`Follow logs failed: ${String(error)}`); } });
            child.once('close', (code) => {
                closed = true;
                if (timer) { clearTimeout(timer); }
                if (!cancelled) {
                    const remaining = decoder.end();
                    if (remaining) { panel.addContent(remaining); }
                    if (code !== 0) { void vscode.window.showErrorMessage(`Follow logs failed: ${stderr || `kubectl exited with code ${code}`}`); }
                }
                lease.lines.complete();
            });
            if (cancelled) { stopChild(); }
            return;
        }
        const result = await kubectl.invokeCommandArgs(args);
        if (cancelled) { return; }
        if (ExecResult.failed(result)) {
            await kubectl.reportFailure(result, { whatFailed: 'Error reading logs' });
        } else {
            panel.addContent(result.stdout);
        }
    } catch (err) {
        if (!cancelled) { await vscode.window.showErrorMessage(`Error reading logs ${err}`); }
    }
}

/**
 * Searches for a pod yaml spec from the open document
 * or from the currently selected namespace.
 */
async function logsForPod(kubectl: Kubectl): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
        return logsForPodFromOpenDocument(kubectl, editor);
    }

    return logsForPodFromCurrentNamespace(kubectl);
}

/**
 * Finds a Pod from the open editor.
 */
async function logsForPodFromOpenDocument(kubectl: Kubectl, editor: vscode.TextEditor) {
    const text = editor.document.getText();
    try {
        const obj: unknown = yaml.load(text);
        if (isPod(obj)) {
            // document describes a pod.
            const podSummary = {
                name: obj.metadata.name,
                namespace: obj.metadata.namespace
            };

            return await getLogsForPod(kubectl, podSummary);
        }
    } catch (ex) {
        // pass
    }

    return logsForPodFromCurrentNamespace(kubectl);
}

/**
 * Alerts the user on pods available in the current namespace.
 */
async function logsForPodFromCurrentNamespace(kubectl: Kubectl) {
    const namespace = await kubectlUtils.currentNamespace(kubectl);

    const pod = await quickPickKindName(
        [kuberesources.allKinds.pod],
        { nameOptional: false }
    );
    if (pod) {
        const podSummary: PodSummary = {
            name: pod.split('/')[1],
            namespace: namespace // should figure out how to handle namespaces.
        };

        await getLogsForPod(kubectl, podSummary);
    }
}
