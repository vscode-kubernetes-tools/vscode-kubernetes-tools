import * as vscode from 'vscode';
import { Kubectl } from '../../kubectl';
import { selectContainerForPod, PodSummary, quickPickKindName } from '../../extension';
import { isPod } from '../../kuberesources.objectmodel';
import * as kuberesources from '../../kuberesources';
import { ResourceNode } from '../../explorer';
import * as yaml from 'js-yaml';
import * as kubectlUtils from '../../kubectlUtils';
import { host } from '../../host';
import { LogsPanel } from '../../components/logs/logsWebview';
import { ShellResult } from '../../shell';

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
    explorerNode: ResourceNode | undefined,
    displayMode: LogsDisplayMode
) {
    if (explorerNode) {
        return await getLogsForExplorerPod(kubectl, explorerNode, displayMode);
    }

    return logsForPod(kubectl, displayMode);
}

/**
 * Fetch logs from a Pod, when selected from the Explorer.
 */
async function getLogsForExplorerPod(
    kubectl: Kubectl,
    explorerNode: ResourceNode,
    displayMode: LogsDisplayMode
) {
    const namespace = explorerNode.namespace;
    const podSummary = { name: explorerNode.id, namespace: namespace || undefined };  // TODO: rationalise null and undefined

    return await getLogsForPod(kubectl, podSummary, displayMode);
}

/**
 * Fetches logs for a pod. If there are more than one containers,
 * prompts the user for which container to fetch logs for.
 */
async function getLogsForPod(kubectl: Kubectl, podSummary: PodSummary, displayMode: LogsDisplayMode) {
    if (!podSummary) {
        vscode.window.showErrorMessage('Can\'t find a pod!');
        return;
    }

    const container = await selectContainerForPod(podSummary);
    if (!container) {
        return;
    }

    await getLogsForContainer(kubectl, podSummary, container.name, displayMode);
}

/**
 * Gets the logs for a container in a provided pod, in a provided namespace, in a provided container.
 */
async function getLogsForContainer(
    kubectl: Kubectl,
    podSummary: PodSummary,
    containerName: string | undefined,
    displayMode: LogsDisplayMode
) {
    let cmd = `logs ${podSummary.name}`;

    if (podSummary.namespace) {
        cmd = `${cmd} --namespace=${podSummary.namespace}`;
    }

    if (containerName) {
        cmd = `${cmd} --container=${containerName}`;
    }

    if (displayMode === LogsDisplayMode.Follow) {
        cmd = `${cmd} -f`;
        kubectl.invokeInNewTerminal(cmd, `${podSummary.name}-${containerName}`);
        return;
    }

    const resource = `${podSummary.namespace}/${podSummary.name}`;
    const panel = LogsPanel.createOrShow('Loading \u25CC', resource);

    try {
        console.log('executing ' + cmd);
        const result = await kubectl.invokeAsync(cmd);
        console.log('got: ' + result.stdout);
        panel.setInfo(result.stdout, resource);
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

    quickPickKindName(
        [kuberesources.allKinds.pod],
        { nameOptional: false },
        async (pod) => {

            const podSummary: PodSummary = {
                name: pod.split('/')[1],
                namespace: namespace // should figure out how to handle namespaces.
            };

            await getLogsForPod(kubectl, podSummary, displayMode);
        }
    );
}
