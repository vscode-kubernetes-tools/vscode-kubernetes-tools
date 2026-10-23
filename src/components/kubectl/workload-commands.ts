import { isSafeNamespace, isSafeResourceName, normaliseResourceTarget } from './resource-commands';

export interface ExposeResourceOptions {
    readonly port?: string | number;
    readonly type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
}

export interface RunImageOptions {
    readonly imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never';
    readonly ports?: readonly (string | number)[];
    readonly environment?: Readonly<Record<string, unknown>>;
    readonly additionalArgs?: readonly string[];
}

export function scaleResourceArgs(resource: string, replicas: number): string[] | undefined {
    const target = normaliseResourceTarget(resource, false);
    if (!target || !Number.isInteger(replicas) || replicas < 0) {
        return undefined;
    }
    return ['scale', `--replicas=${replicas}`, target];
}

export function restartResourceArgs(resource: string, namespace?: string): string[] | undefined {
    const target = normaliseResourceTarget(resource, false);
    if (!target || (namespace !== undefined && namespace !== '' && !isSafeNamespace(namespace))) {
        return undefined;
    }
    return ['rollout', 'restart', target, ...(namespace ? ['--namespace', namespace] : [])];
}

export function exposeResourceArgs(resource: string, options: ExposeResourceOptions = {}): string[] | undefined {
    const target = normaliseResourceTarget(resource, false);
    if (!target) {
        return undefined;
    }
    return [
        'expose', target,
        ...(options.type ? [`--type=${options.type}`] : []),
        ...(options.port !== undefined ? [`--port=${options.port}`] : []),
    ];
}

export function runImageArgs(name: string, image: string, options: RunImageOptions = {}): string[] | undefined {
    if (!isSafePositionalName(name) || image.length === 0) {
        return undefined;
    }
    return [
        'run', name, `--image=${image}`,
        ...(options.imagePullPolicy ? [`--image-pull-policy=${options.imagePullPolicy}`] : []),
        ...(options.ports || []).map((port) => `--port=${port}`),
        ...Object.entries(options.environment || {}).map(([key, value]) => `--env=${key}=${value}`),
        ...(options.additionalArgs || []),
    ];
}

export function createJobFromCronJobArgs(jobName: string, cronJobName: string, namespace?: string): string[] | undefined {
    const cronJob = normaliseResourceTarget(`cronjob/${cronJobName}`, false);
    if (!isSafePositionalName(jobName) || !cronJob ||
        (namespace !== undefined && namespace !== '' && !isSafeNamespace(namespace))) {
        return undefined;
    }
    return ['create', 'job', jobName, ...(namespace ? ['--namespace', namespace] : []), `--from=${cronJob}`];
}

export function remoteShellCommandArgs(command: string): string[] {
    return ['-i', '--attach=false', '--command', '--', '/bin/sh', '-c', command];
}

function isSafePositionalName(value: string): boolean {
    return isSafeResourceName(value) && !value.startsWith('-');
}
