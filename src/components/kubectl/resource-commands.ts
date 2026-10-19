import { ExecResult } from '../../binutilplusplus';
import { Kubectl } from '../../kubectl';
import { Errorable } from '../../errorable';

export interface DeleteResourceOptions {
    readonly kubectl: Kubectl;
    readonly resource: string;
    readonly namespace?: string;
    readonly now: boolean;
    readonly confirm: () => Promise<boolean>;
    readonly beforeDelete?: () => Promise<boolean>;
    readonly report: (result: ExecResult) => Promise<void>;
}

export async function deleteResourceWithConfirmation(options: DeleteResourceOptions): Promise<boolean> {
    if (!isSafeResourceTarget(options.resource) ||
        (options.namespace !== undefined && !isSafeNamespace(options.namespace))) {
        return false;
    }
    if (!await options.confirm()) {
        return false;
    }
    if (options.beforeDelete && !await options.beforeDelete()) {
        return false;
    }

    const args = [
        'delete',
        options.resource,
        ...(options.namespace ? ['--namespace', options.namespace] : []),
        ...(options.now ? ['--now'] : []),
    ];
    const result = await options.kubectl.invokeCommandArgsWithFeedback(args, `Deleting ${options.resource}...`);
    await options.report(result);
    return true;
}

export async function listNamespaceResources(kubectl: Kubectl, namespace: string): Promise<Errorable<string[]>> {
    if (!isSafeNamespace(namespace)) {
        return { succeeded: false, error: ['Invalid Kubernetes namespace.'] };
    }
    const apiResources = await kubectl.readTableArgs(['api-resources', '-o', 'wide']);
    if (ExecResult.failed(apiResources)) {
        return { succeeded: false, error: [ExecResult.failureMessage(apiResources, {})] };
    }
    const resourceKinds = apiResources.result.filter((resource) => resource.namespaced === 'true')
        .filter((resource) => resource.verbs.includes('list'))
        .map((resource) => resource.name);
    if (resourceKinds.length === 0 || resourceKinds.some((resource) => !isSafeResourceType(resource))) {
        return { succeeded: false, error: ['The Kubernetes endpoint returned an invalid resource type.'] };
    }

    const listed = await kubectl.invokeCommandArgs([
        'get', resourceKinds.join(','), '-o', 'name', '--namespace', namespace, '--ignore-not-found'
    ]);
    if (ExecResult.failed(listed)) {
        return { succeeded: false, error: [ExecResult.failureMessage(listed, {})] };
    }
    return {
        succeeded: true,
        result: listed.stdout.split('\n').map((line) => line.trim()).filter((line) => line.length > 0),
    };
}

export function normaliseResourceTarget(value: string, allowKindOnly: boolean): string | undefined {
    const trimmed = value.trim();
    if (isSafeResourceTarget(trimmed) || (allowKindOnly && isSafeResourceType(trimmed))) {
        return trimmed;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length === 2 && isSafeResourceType(parts[0]) && isSafeResourceName(parts[1])) {
        return `${parts[0]}/${parts[1]}`;
    }
    return undefined;
}

export function isSafeResourceType(value: string): boolean {
    return value.length > 0 && value.length <= 253 &&
        /^[a-z](?:[-a-z0-9]*[a-z0-9])?(?:\.[a-z0-9](?:[-a-z0-9]*[a-z0-9])?)*$/.test(value);
}

export function isSafeResourceName(value: string): boolean {
    return value.length > 0 &&
        value !== '.' && value !== '..' &&
        !value.includes('/') && !value.includes('%') &&
        !/[\u0000-\u001f\u007f-\u009f]/.test(value);
}

export function isSafeNamespace(value: string): boolean {
    return value.length > 0 && value.length <= 63 &&
        /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/.test(value);
}

export function isSafeResourceTarget(value: string): boolean {
    const parts = value.split('/');
    return parts.length === 2 && isSafeResourceType(parts[0]) && isSafeResourceName(parts[1]);
}
