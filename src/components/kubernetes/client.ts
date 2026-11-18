import type { KubeConfig } from '@kubernetes/client-node';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { workspace } from 'vscode';
import { getKubeconfigFiles, getKubeconfigPath, KubeconfigSelection, loadKubeconfig, readKubeconfigSources } from '../kubectl/kubeconfig';
import { isSafeNamespace } from '../kubectl/resource-commands';

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

export function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function createKubernetesConnection(): Promise<KubernetesConnection> {
    const selectedPath = getKubeconfigPath();
    const cwd = workspace.rootPath ?? process.cwd();
    const kubeconfigPath = selectedPath.pathType === 'host' ? {
        pathType: 'host' as const,
        hostPath: getKubeconfigFiles(selectedPath).map((file) => path.resolve(cwd, file)).join(path.delimiter),
    } : selectedPath;
    const parsedSources = (await readKubeconfigSources(kubeconfigPath)).flatMap((source) => {
        const document: unknown = yaml.load(source.contents);
        if (document === undefined || document === null) { return []; }
        if (!isRecord(document)) {
            throw new Error('The Kubernetes configuration is invalid.');
        }
        return [{ source, document }];
    });
    const sources = parsedSources.map(({ source }) => source);
    const documents = parsedSources.map(({ document }) => document);
    const contextName = documents.map((document) => document['current-context']).find((name) => typeof name === 'string' && name.length > 0);
    if (typeof contextName !== 'string') {
        throw new Error('The Kubernetes configuration has no current context.');
    }
    const entries = (field: string) => documents.flatMap((document) => Array.isArray(document[field]) ? document[field].filter(isRecord) : []);
    const context = entries('contexts').find((entry) => entry.name === contextName)?.context;
    if (!isRecord(context) || typeof context.cluster !== 'string' ||
        !entries('clusters').some((entry) => entry.name === context.cluster) ||
        (context.user !== undefined && context.user !== null &&
            (typeof context.user !== 'string' || (context.user !== '' && !entries('users').some((entry) => entry.name === context.user))))) {
        throw new Error('The current Kubernetes context is incomplete.');
    }
    const namespace = context.namespace === undefined || context.namespace === null || context.namespace === '' ? 'default' : context.namespace;
    if (typeof namespace !== 'string' || !isSafeNamespace(namespace)) {
        throw new Error('The current Kubernetes namespace is invalid.');
    }
    const cluster = entries('clusters').find((entry) => entry.name === context.cluster)?.cluster;

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

    const config = await loadKubeconfig(kubeconfigPath, sources);
    if (!config.getCurrentCluster()) {
        throw new Error('The current Kubernetes context has no cluster.');
    }
    return { transport: 'client', config, namespace };
}
