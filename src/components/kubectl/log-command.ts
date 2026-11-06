import { normaliseResourceReadTarget, isSafeNamespace } from './resource-commands';

export interface LogCommandOptions {
    readonly namespace?: string;
    readonly resource: string;
    readonly container: string;
    readonly follow: boolean;
    readonly timestamps: boolean;
    readonly since: string;
    readonly tail: number;
}

export function logsArgs(options: LogCommandOptions): string[] | undefined {
    const target = typeof options.resource === 'string' ? normaliseResourceReadTarget(options.resource, false) : undefined;
    if (!target || (options.namespace !== undefined && options.namespace !== '' &&
        (typeof options.namespace !== 'string' || !isSafeNamespace(options.namespace))) ||
        typeof options.container !== 'string' || (options.container !== '' &&
            (options.container.length > 63 || !/^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/.test(options.container))) ||
        typeof options.follow !== 'boolean' || typeof options.timestamps !== 'boolean' ||
        typeof options.since !== 'string' || !/^(?:0|(?:[0-9]+(?:\.[0-9]+)?(?:ns|us|µs|μs|ms|s|m|h))+)$/.test(options.since) ||
        !Number.isSafeInteger(options.tail) || options.tail < -1) {
        return undefined;
    }
    return ['logs', target,
        ...(options.namespace ? [`--namespace=${options.namespace}`] : []),
        ...(options.container ? [`--container=${options.container}`] : []),
        ...(options.follow ? ['-f'] : []),
        ...(options.timestamps ? ['--timestamps=true'] : []),
        ...(options.since !== '0' ? [`--since=${options.since}`] : []),
        ...(options.tail > -1 ? [`--tail=${options.tail}`] : []),
    ];
}

export function eventsArgs(namespace: string, follow: boolean): string[] | undefined {
    if (typeof namespace !== 'string' || (namespace !== '' && !isSafeNamespace(namespace))) {
        return undefined;
    }
    return ['get', 'events', ...(namespace ? ['--namespace', namespace] : []), ...(follow ? ['-w'] : [])];
}
