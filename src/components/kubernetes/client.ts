import type { KubeConfig } from '@kubernetes/client-node';
import * as path from 'path';
import { workspace } from 'vscode';
import { getKubeconfigFiles, getKubeconfigPath, isRecord, KubeconfigSelection, loadKubeconfig, readKubeconfigSnapshot } from '../kubectl/kubeconfig';
import { isSafeNamespace } from '../kubectl/resource-commands';

export { isRecord } from '../kubectl/kubeconfig';

export type KubernetesConnection = {
    readonly transport: 'client';
    readonly config: KubeConfig;
    readonly namespace: string;
} | {
    readonly transport: 'cli';
    readonly selection: KubeconfigSelection;
    readonly namespace: string;
    readonly useWsl: boolean;
};

const CLIENT_USER_FIELDS = new Set([
    'token', 'username', 'password', 'client-certificate', 'client-certificate-data', 'client-key', 'client-key-data'
]);
const CLIENT_CLUSTER_FIELDS = new Set([
    'server', 'certificate-authority', 'certificate-authority-data', 'insecure-skip-tls-verify', 'tls-server-name', 'proxy-url'
]);

export async function createKubernetesConnection(): Promise<KubernetesConnection> {
    const selectedPath = getKubeconfigPath();
    const cwd = workspace.rootPath ?? process.cwd();
    const kubeconfigPath = selectedPath.pathType === 'host' ? {
        pathType: 'host' as const,
        hostPath: getKubeconfigFiles(selectedPath).map((file) => path.resolve(cwd, file)).join(path.delimiter),
    } : selectedPath;
    const snapshot = await readKubeconfigSnapshot(kubeconfigPath);
    const contextName = snapshot.currentContext;
    if (!contextName) {
        throw new Error('The Kubernetes configuration has no current context.');
    }
    const selectedContext = snapshot.contexts.find((entry) => entry.name === contextName);
    const context = selectedContext?.value;
    const selectedCluster = snapshot.clusters.find((entry) => entry.name === context?.cluster);
    const selectedUser = typeof context?.user === 'string' && context.user !== '' ? snapshot.users.find((entry) => entry.name === context.user) : undefined;
    if (!selectedContext || !context || typeof context.cluster !== 'string' || !selectedCluster ||
        (context.user !== undefined && context.user !== null &&
            (typeof context.user !== 'string' || (context.user !== '' && !selectedUser)))) {
        throw new Error('The current Kubernetes context is incomplete.');
    }
    const namespace = context.namespace === undefined || context.namespace === null || context.namespace === '' ? 'default' : context.namespace;
    if (typeof namespace !== 'string' || !isSafeNamespace(namespace)) {
        throw new Error('The current Kubernetes namespace is invalid.');
    }
    const cluster = selectedCluster.value;
    const entries = (field: string) => snapshot.documents.flatMap(({ document }) => Array.isArray(document[field]) ? document[field].filter(isRecord) : []);

    // Choose compatibility paths before dispatch, never after an API failure.
    const requiresCli = kubeconfigPath.pathType === 'wsl' ||
        (isRecord(cluster) && typeof cluster.server === 'string' && cluster.server.startsWith('http:') && cluster['insecure-skip-tls-verify'] !== true) ||
        ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'].some((key) => !!process.env[key]) ||
        entries('users').some((entry) => !isRecord(entry.user) || Object.keys(entry.user).some((key) => !CLIENT_USER_FIELDS.has(key))) ||
        entries('clusters').some((entry) => !isRecord(entry.cluster) || Object.keys(entry.cluster).some((key) => !CLIENT_CLUSTER_FIELDS.has(key))) ||
        Object.keys(context).some((key) => !['cluster', 'user', 'namespace'].includes(key));
    if (requiresCli) {
        return {
            transport: 'cli', namespace, useWsl: kubeconfigPath.pathType === 'wsl',
            selection: { kubeconfig: kubeconfigPath.pathType === 'host' ? kubeconfigPath.hostPath : kubeconfigPath.wslPath, context: contextName },
        };
    }

    // client-node only applies the cluster CA when a user object exists.
    const user = selectedUser ?? { name: 'vscode-kubernetes-anonymous', value: {}, file: selectedContext.file };
    const sources = snapshot.documents.map(({ source }) => ({
        file: source.file,
        contents: JSON.stringify({
            'current-context': contextName,
            contexts: source.file === selectedContext.file ? [{ name: contextName, context: { ...context, user: user.name } }] : [],
            clusters: source.file === selectedCluster.file ? [{ name: selectedCluster.name, cluster }] : [],
            users: source.file === user.file ? [{ name: user.name, user: user.value }] : [],
        }),
    }));
    const config = await loadKubeconfig(kubeconfigPath, sources);
    if (!config.getCurrentCluster()) {
        throw new Error('The current Kubernetes context has no cluster.');
    }
    return { transport: 'client', config, namespace };
}
