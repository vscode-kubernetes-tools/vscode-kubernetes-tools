import { ExecResult } from '../../binutilplusplus';
import { Kubectl } from '../../kubectl';

export function getResourceArgs(resource: string, namespace?: string): string[] {
    return ['get', resource, ...(namespace ? ['--namespace', namespace] : []), '-o', 'wide'];
}

export function scaleResourceArgs(resource: string, replicas: number): string[] {
    return ['scale', `--replicas=${replicas}`, resource];
}

export function restartResourceArgs(resource: string, namespaceArgs: readonly string[]): string[] {
    return ['rollout', 'restart', resource, ...namespaceArgs];
}

export function execResourceArgs(
    pod: string,
    container: string,
    remoteShell: '/bin/bash' | '/bin/sh',
    command: string
): string[] {
    return ['exec', pod, '-c', container, '--', remoteShell, '-c', command];
}

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
    const result = await options.kubectl.invokeCommandWithFeedback(args, `Deleting ${options.resource}...`);
    await options.report(result);
    return true;
}
