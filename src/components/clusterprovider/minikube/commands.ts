import { Errorable } from '../../../errorable';

export const MINIKUBE_VM_DRIVERS = [
    'virtualbox',
    'vmwarefusion',
    'kvm',
    'xhyve',
    'hyperv',
    'hyperkit',
    'kvm2',
    'none',
    'docker',
    'podman',
    'qemu',
    'qemu2',
    'vfkit',
    'krunkit',
    'parallels',
    'ssh',
    'vmware',
] as const;

const MINIKUBE_VM_DRIVER_SET = new Set<string>(MINIKUBE_VM_DRIVERS);

export interface MinikubeStartOptions {
    readonly vmDriver?: string;
    readonly additionalFlags?: string;
}

export interface MinikubeStartCommand {
    readonly args: string[];
    readonly profile?: string;
}

export function minikubeStartCommand(options: MinikubeStartOptions): Errorable<MinikubeStartCommand> {
    const additionalFlags = parseAdditionalFlags(options.additionalFlags || '');
    if (!additionalFlags.succeeded) {
        return { succeeded: false, error: additionalFlags.error };
    }
    const profile = profileFromArgs(additionalFlags.result);
    if (!profile.succeeded) {
        return { succeeded: false, error: profile.error };
    }
    if (options.vmDriver && !MINIKUBE_VM_DRIVER_SET.has(options.vmDriver)) {
        return { succeeded: false, error: ['Invalid Minikube VM driver.'] };
    }
    return {
        succeeded: true,
        result: {
            args: [
                'start',
                ...additionalFlags.result,
                ...(options.vmDriver ? [`--vm-driver=${options.vmDriver}`] : []),
            ],
            profile: profile.result,
        },
    };
}

export function minikubeLifecycleArgs(command: 'status' | 'stop', profile?: string): string[] {
    return [...(profile ? ['--profile', profile] : []), command];
}

export function parseAdditionalFlags(value: string): Errorable<string[]> {
    const args: string[] = [];
    let current = '';
    let quote: 'single' | 'double' | undefined;
    let tokenStarted = false;

    for (let index = 0; index < value.length; index++) {
        const character = value[index];
        if (character === '\0' || character === '\r' || character === '\n') {
            return invalid('Control characters are not supported in additional flags.');
        }
        if (!quote && /\s/.test(character)) {
            if (tokenStarted) {
                args.push(current);
                current = '';
                tokenStarted = false;
            }
            continue;
        }
        if (!quote && [';', '&', '|', '<', '>', '`'].includes(character)) {
            return invalid('Shell operators are not supported in additional flags.');
        }
        if (character === "'" && quote !== 'double') {
            quote = quote === 'single' ? undefined : 'single';
            tokenStarted = true;
            continue;
        }
        if (character === '"' && quote !== 'single') {
            quote = quote === 'double' ? undefined : 'double';
            tokenStarted = true;
            continue;
        }
        if (character === '\\' && quote !== 'single') {
            const next = value[index + 1];
            const escapable = next === '"' || (!quote && !!next && /\s/.test(next));
            if (escapable) {
                current += next;
                tokenStarted = true;
                index++;
                continue;
            }
        }
        current += character;
        tokenStarted = true;
    }

    if (quote) {
        return invalid('Additional flags contain an unterminated quoted argument.');
    }
    if (tokenStarted) {
        args.push(current);
    }
    if (args.length > 0 && !args[0].startsWith('-')) {
        return invalid('Additional Minikube arguments must begin with a flag.');
    }
    return { succeeded: true, result: args };
}

function profileFromArgs(args: readonly string[]): Errorable<string | undefined> {
    let profile: string | undefined;
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        let value: string | undefined;
        if (arg === '--profile' || arg === '-p') {
            value = args[++index];
            if (!value || value.startsWith('-')) {
                return { succeeded: false, error: ['The Minikube profile flag requires a value.'] };
            }
        } else if (arg.startsWith('--profile=') || arg.startsWith('-p=')) {
            value = arg.substring(arg.indexOf('=') + 1);
            if (!value) {
                return { succeeded: false, error: ['The Minikube profile flag requires a value.'] };
            }
        } else if (arg.startsWith('-p') && arg.length > 2) {
            value = arg.substring(2);
        }
        if (value !== undefined) {
            if (profile !== undefined) {
                return { succeeded: false, error: ['The Minikube profile flag may be specified only once.'] };
            }
            profile = value;
        }
    }
    return { succeeded: true, result: profile };
}

function invalid(message: string): Errorable<string[]> {
    return { succeeded: false, error: [message] };
}
