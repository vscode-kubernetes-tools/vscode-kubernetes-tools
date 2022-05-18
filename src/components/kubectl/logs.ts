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
    const args = ['logs', kindName];

    if (namespace) {
        args.push(`--namespace=${namespace}`);
    }

    if (containerName) {
        args.push(`--container=${containerName}`);
    }

    if (displayMode === LogsDisplayMode.Follow) {
        args.push('-f');
    }

    if (showTimestamp) {
        args.push('--timestamps=true');
    }

    if (since !== '0') {
        args.push(`--since=${since}`);
    }

    if (tail > -1) {
        args.push(`--tail=${tail}`);
    }

    const cmd = args.join(' ');

    if (destination === LogsDestination.Terminal) {
        if (displayMode === LogsDisplayMode.Follow) {
            const title = `Logs: ${kindName}${containerName ? ('/' + containerName) : ''}`;
            kubectl.invokeInNewTerminal(cmd, title);
        } else {
            kubectl.invokeInSharedTerminal(cmd);
        }
        return;
    }

    if (displayMode === LogsDisplayMode.Follow) {
        const followProcess = await kubectl.observeCommand(args);
        panel.setAppendContentProcess(followProcess);

        // TODO: during rebase, we will need to also provide the followProcess.terminate method to the viewer
        followProcess.lines.subscribe(
            (line) => { if (line) { panel.addContent(`${line}\n`); } },
            (err: ExecResult) => kubectl.reportResult(err, { whatFailed: `Follow logs failed` })
        );

        return;
    }

    try {
        const result = await kubectl.invokeCommand(cmd);
        if (ExecResult.failed(result)) {
            kubectl.reportFailure(result, { whatFailed: 'Error reading logs' });
        } else {
            panel.deleteAppendContentProcess();
            panel.addContent(result.stdout);
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Error reading logs ${err}`);
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
        const obj: {} = yaml.safeLoad(text);
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
