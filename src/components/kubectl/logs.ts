import * as vscode from 'vscode';
import { Kubectl } from '../../kubectl';
import { PodSummary, quickPickKindName, selectContainerForResource } from '../../extension';
import { isPod } from '../../kuberesources.objectmodel';
import * as kuberesources from '../../kuberesources';
import * as yaml from 'js-yaml';
import * as kubectlUtils from '../../kubectlUtils';
import { LogsPanel } from '../../components/logs/logsWebview';
import { ContainerContainer } from '../../utils/containercontainer';
import { ClusterExplorerResourceNode } from '../clusterexplorer/node';
import { logsDisplay, LogsDisplay } from '../config/config';
import { ExecResult } from '../../binutilplusplus';

export enum LogsDisplayMode {
    Show,
    Follow,
    Limit
}

/**
 * Fetches logs for a Pod. Handles use cases for fetching pods
 * from an open document, or from the current namespace.
 */
export async function logsKubernetes(
    kubectl: Kubectl,
    explorerNode: ClusterExplorerResourceNode | undefined,
    displayMode: LogsDisplayMode
) {
    if (explorerNode) {
        return await getLogsForExplorerNode(kubectl, explorerNode, displayMode);
    }

    return logsForPod(kubectl, displayMode);
}

/**
 * Fetch logs from a Pod, when selected from the Explorer.
 */
async function getLogsForExplorerNode(
    kubectl: Kubectl,
    explorerNode: ClusterExplorerResourceNode,
    displayMode: LogsDisplayMode
) {
    const resource = ContainerContainer.fromNode(explorerNode);
    if (!resource) {
        return;
    }

    return await getLogsForResource(kubectl, resource, displayMode);
}

/**
 * Fetches logs for a pod. If there are more than one containers,
 * prompts the user for which container to fetch logs for.
 */
async function getLogsForPod(kubectl: Kubectl, pod: PodSummary, displayMode: LogsDisplayMode) {
    const resource = {
        kindName: `pod/${pod.name}`,
        namespace: pod.namespace,
        containers: pod.spec ? pod.spec.containers : undefined,
        containersQueryPath: '.spec'
    };
    return getLogsForResource(kubectl, resource, displayMode);
}

async function getLogsForResource(kubectl: Kubectl, resource: ContainerContainer, displayMode: LogsDisplayMode) {
    if (!resource) {
        vscode.window.showErrorMessage('Can\'t find the resource to get logs from!');
        return;
    }

    const container = await selectContainerForResource(resource);
    if (!container) {
        return;
    }

    await getLogsForContainer(kubectl, resource, container.name, displayMode);
}

/**
 * Gets the logs for a container in a provided pod, in a provided namespace, in a provided container.
 */
async function getLogsForContainer(
    kubectl: Kubectl,
    containerResource: ContainerContainer,
    containerName: string | undefined,
    displayMode: LogsDisplayMode
) {
    const args = ['logs', containerResource.kindName];

    if (containerResource.namespace) {
        args.push(`--namespace=${containerResource.namespace}`);
    }

    if (containerName) {
        args.push(`--container=${containerName}`);
    }

    if (displayMode === LogsDisplayMode.Follow) {
        args.push('-f');
    }

    if (displayMode === LogsDisplayMode.Limit) {
        args.push('--since=5m');
    }

    const cmd = args.join(' ');

    if (logsDisplay() === LogsDisplay.Terminal) {
        if (displayMode === LogsDisplayMode.Follow) {
            const title = `Logs: ${containerResource.kindName}${containerName ? ('/' + containerName) : ''}`;
            kubectl.invokeInNewTerminal(cmd, title);
        } else {
            kubectl.invokeInSharedTerminal(cmd);
        }
        return;
    }

    const resource = `${containerResource.namespace}/${containerResource.kindName}`;
    const panel = LogsPanel.createOrShow('Loading...', resource);

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
            panel.setContent(result.stdout);
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Error reading logs ${err}`);
    }
}

/**
 * Searches for a pod yaml spec from the open document
 * or from the currently selected namespace.
 */
async function logsForPod(kubectl: Kubectl, displayMode: LogsDisplayMode): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
        return await logsForPodFromOpenDocument(kubectl, editor, displayMode);
    }

    return await logsForPodFromCurrentNamespace(kubectl, displayMode);
}

/**
 * Finds a Pod from the open editor.
 */
async function logsForPodFromOpenDocument(kubectl: Kubectl, editor: vscode.TextEditor, displayMode: LogsDisplayMode) {
    const text = editor.document.getText();
    try {
        const obj: {} = yaml.safeLoad(text);
        if (isPod(obj)) {
            // document describes a pod.
            const podSummary = {
                name: obj.metadata.name,
                namespace: obj.metadata.namespace
            };

            return await getLogsForPod(kubectl, podSummary, displayMode);
        }
    } catch (ex) {
        // pass
    }

    return await logsForPodFromCurrentNamespace(kubectl, displayMode);
}

/**
 * Alerts the user on pods available in the current namespace.
 */
async function logsForPodFromCurrentNamespace(kubectl: Kubectl, displayMode: LogsDisplayMode) {
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

        await getLogsForPod(kubectl, podSummary, displayMode);
    }
}
