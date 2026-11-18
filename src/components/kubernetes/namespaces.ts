import type { HttpLibrary } from '@kubernetes/client-node';
import fetch, { FetchError } from 'node-fetch';
import { Errorable } from '../../errorable';
import { Namespace, ObjectMeta } from '../../kuberesources.objectmodel';
import type { Kubectl } from '../../kubectl';
import { ProcessExecutionError } from '../../process';
import { isSafeNamespace } from '../kubectl/resource-commands';
import { createKubernetesConnection, isRecord } from './client';
import { getUseWsl } from '../config/config';

export const MAX_NAMESPACE_RESPONSE_BYTES = 20 * 1024 * 1024;
const NAMESPACE_TIMEOUT_MS = 30_000;

export interface NamespaceList {
    readonly items: Namespace[];
    readonly currentNamespace: string;
}

class NamespaceResponseError extends Error {}

function namespacesFromResponse(value: unknown): Namespace[] {
    if (!isRecord(value) || !Array.isArray(value.items)) {
        throw new NamespaceResponseError('The Kubernetes endpoint returned invalid namespace metadata.');
    }
    return value.items.map((item: unknown) => {
        if (!isRecord(item) || !isRecord(item.metadata) || typeof item.metadata.name !== 'string' ||
            !isSafeNamespace(item.metadata.name) ||
            (item.metadata.namespace !== undefined && item.metadata.namespace !== '') ||
            (item.kind !== undefined && item.kind !== 'Namespace')) {
            throw new NamespaceResponseError('The Kubernetes endpoint returned invalid namespace metadata.');
        }
        const metadata: ObjectMeta = { ...item.metadata, name: item.metadata.name, namespace: '' };
        return { kind: 'Namespace', metadata };
    });
}

export async function listNamespaces(kubectl: Kubectl, signal?: AbortSignal): Promise<Errorable<NamespaceList>> {
    let deadline: AbortSignal | undefined;
    try {
        signal?.throwIfAborted();
        const connection = await createKubernetesConnection();
        signal?.throwIfAborted();
        if (connection.transport === 'cli') {
            if (!!getUseWsl() !== connection.useWsl) {
                throw new ProcessExecutionError('cancelled', 'Kubernetes execution mode changed.');
            }
            const result = await kubectl.executeCommandArgs(['get', 'namespaces', '-o', 'json'], undefined, { ...connection.selection, signal });
            if (result.code !== 0 || result.signal) {
                return { succeeded: false, error: ['Unable to list Kubernetes namespaces. Check your connection, permissions and sign-in state.'] };
            }
            return { succeeded: true, result: { items: namespacesFromResponse(JSON.parse(result.stdout)), currentNamespace: connection.namespace } };
        }

        const { ApiException, CoreV1Api, Observable, ResponseContext, SelfDecodingBody } = await import('@kubernetes/client-node');
        deadline = AbortSignal.timeout(NAMESPACE_TIMEOUT_MS);
        const cancellation = signal ? AbortSignal.any([signal, deadline]) : deadline;
        let remainingBytes = MAX_NAMESPACE_RESPONSE_BYTES;
        // The SDK's default transport buffers without a response-size limit.
        const httpApi: HttpLibrary = {
            send: (request) => new Observable((async () => {
                cancellation.throwIfAborted();
                if (remainingBytes <= 0) {
                    throw new NamespaceResponseError('The Kubernetes namespace response exceeded the 20 MiB limit.');
                }
                const response = await fetch(request.getUrl(), {
                    method: request.getHttpMethod(), headers: request.getHeaders(), agent: request.getAgent(),
                    signal: cancellation, size: remainingBytes,
                });
                const body = Buffer.from(await response.arrayBuffer());
                remainingBytes -= body.length;
                return new ResponseContext(response.status, Object.fromEntries(response.headers.entries()), new SelfDecodingBody(Promise.resolve(body)));
            })()),
        };
        const client = connection.config.makeApiClient(CoreV1Api);
        const items: Namespace[] = [];
        const continuations = new Set<string>();
        let next: string | undefined;
        try {
            do {
                cancellation.throwIfAborted();
                const page = await client.listNamespace({ limit: 500, _continue: next }, { httpApi });
                for (const item of namespacesFromResponse(page)) {
                    items.push(item);
                }
                const { _continue: continuation } = page.metadata ?? {};
                if (continuation !== undefined && (typeof continuation !== 'string' || (continuation !== '' && continuations.has(continuation)))) {
                    throw new NamespaceResponseError('The Kubernetes endpoint returned invalid namespace pagination.');
                }
                next = continuation;
                if (next) { continuations.add(next); }
            } while (next);
        } catch (error) {
            if (error instanceof ApiException) {
                if (error.code === 401) {
                    return { succeeded: false, error: ['Kubernetes authentication failed (HTTP 401). Sign in again and retry.'] };
                }
                if (error.code === 403) {
                    return { succeeded: false, error: ['You do not have permission to list Kubernetes namespaces (HTTP 403).'] };
                }
                return { succeeded: false, error: [`Unable to list Kubernetes namespaces (HTTP ${error.code}).`] };
            }
            throw error;
        }
        return { succeeded: true, result: { items, currentNamespace: connection.namespace } };
    } catch (error) {
        if (signal?.aborted || (error instanceof ProcessExecutionError && error.reason === 'cancelled')) {
            return { succeeded: false, error: ['The Kubernetes namespace request was cancelled.'] };
        }
        if (deadline?.aborted) {
            return { succeeded: false, error: ['The Kubernetes namespace request timed out.'] };
        }
        if (error instanceof NamespaceResponseError) {
            return { succeeded: false, error: [error.message] };
        }
        if (error instanceof FetchError && error.type === 'max-size') {
            return { succeeded: false, error: ['The Kubernetes namespace response exceeded the 20 MiB limit.'] };
        }
        return { succeeded: false, error: ['Unable to list Kubernetes namespaces. Check your kubeconfig, connectivity and credentials.'] };
    }
}
