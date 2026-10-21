import { ExecResult, FailedExecResult } from '../../binutilplusplus';
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
    readonly reportValidationError?: (message: string) => void;
}

export async function deleteResourceWithConfirmation(options: DeleteResourceOptions): Promise<boolean> {
    const resource = normaliseResourceTarget(options.resource, false);
    if (!resource ||
        (options.namespace !== undefined && !isSafeNamespace(options.namespace))) {
        options.reportValidationError?.('Invalid Kubernetes resource identifier.');
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
        resource,
        ...(options.namespace ? ['--namespace', options.namespace] : []),
        ...(options.now ? ['--now'] : []),
    ];
    const result = await options.kubectl.invokeCommandArgsWithFeedback(args, `Deleting ${resource}...`);
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

export type ResourceNameListResult = Errorable<string[]> & { readonly execFailure?: FailedExecResult };

export async function listResourceNames(kubectl: Kubectl, resourceType: string, namespace?: string): Promise<ResourceNameListResult> {
    if (!isSafeResourceType(resourceType) || (namespace !== undefined && namespace !== '' && !isSafeNamespace(namespace))) {
        return { succeeded: false, error: ['Invalid Kubernetes resource type or namespace.'] };
    }
    const listed = await kubectl.readTableArgs([
        'get', resourceType, '-o', 'wide', ...(namespace ? ['--namespace', namespace] : [])
    ]);
    if (ExecResult.failed(listed)) {
        return { succeeded: false, error: [ExecResult.failureMessage(listed, {})], execFailure: listed };
    }
    const names: string[] = [];
    for (const row of listed.result) {
        if (typeof row.name !== 'string') {
            return { succeeded: false, error: ['The Kubernetes endpoint returned an invalid resource name.'] };
        }
        const name = canonicalTableResourceName(resourceType, row.name);
        if (!isSafeResourceName(name)) {
            return { succeeded: false, error: ['The Kubernetes endpoint returned an invalid resource name.'] };
        }
        names.push(name);
    }
    return { succeeded: true, result: names };
}

export function normaliseResourceTarget(value: string, allowKindOnly: boolean): string | undefined {
    const trimmed = value.trim();
    const slashParts = trimmed.split('/');
    if (slashParts.length === 2) {
        if (/\s/.test(slashParts[0]) || /\s/.test(slashParts[1])) {
            return undefined;
        }
        const target = `${slashParts[0].toLowerCase()}/${slashParts[1]}`;
        return isSafeResourceTarget(target) ? target : undefined;
    }
    if (slashParts.length !== 1) {
        return undefined;
    }
    const kindOnly = trimmed.toLowerCase();
    if (allowKindOnly && isSafeResourceType(kindOnly)) {
        return kindOnly;
    }
    const parts = trimmed.split(/\s+/);
    const kind = parts[0]?.toLowerCase();
    if (parts.length === 2 && isSafeResourceType(kind) && isSafeResourceName(parts[1])) {
        return `${kind}/${parts[1]}`;
    }
    return undefined;
}

export function normaliseResourceReadTarget(value: string, allowKindOnly: boolean): string | undefined {
    const trimmed = value.trim();
    const slashParts = trimmed.split('/');
    if (slashParts.length === 2) {
        return normaliseResourceTarget(`${slashParts[0].toLowerCase()}/${slashParts[1]}`, false);
    }
    const spaceParts = trimmed.split(/\s+/);
    if (spaceParts.length === 2) {
        return normaliseResourceTarget(`${spaceParts[0].toLowerCase()} ${spaceParts[1]}`, false);
    }
    const kind = trimmed.toLowerCase();
    return allowKindOnly && isSafeResourceType(kind) ? kind : undefined;
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

function canonicalTableResourceName(resourceType: string, name: string): string {
    const unqualifiedType = resourceType.split('.')[0];
    const decoratesDefault = unqualifiedType === 'sc' ||
        unqualifiedType === 'storageclass' || unqualifiedType === 'storageclasses' ||
        unqualifiedType === 'ingressclass' || unqualifiedType === 'ingressclasses';
    return decoratesDefault && name.endsWith(' (default)') ? name.slice(0, -' (default)'.length) : name;
}
