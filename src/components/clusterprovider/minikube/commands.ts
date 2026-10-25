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
    readonly profile?: string;
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
    if (additionalFlags.result.includes('--')) {
        return { succeeded: false, error: ['The Minikube argument terminator is not supported in additional flags.'] };
    }
    if (options.vmDriver && !MINIKUBE_VM_DRIVER_SET.has(options.vmDriver)) {
        return { succeeded: false, error: ['Invalid Minikube VM driver.'] };
    }
    const compatibilityProfile = takeLeadingProfile(additionalFlags.result);
    if (!compatibilityProfile.succeeded) {
        return { succeeded: false, error: compatibilityProfile.error };
    }
    const profile = options.profile || compatibilityProfile.result.profile ||
        (options.profile !== undefined ? 'minikube' : undefined);
    if (profile && !isValidProfile(profile)) {
        return { succeeded: false, error: ['Invalid Minikube profile. Use at least two alphanumeric characters, dots, or internal hyphens.'] };
    }
    return {
        succeeded: true,
        result: {
            args: [
                'start',
                ...compatibilityProfile.result.args,
                ...(options.vmDriver ? [`--vm-driver=${options.vmDriver}`] : []),
                ...(profile ? [`--profile=${profile}`] : []),
            ],
            profile,
        },
    };
}

function takeLeadingProfile(args: readonly string[]): Errorable<{ args: readonly string[]; profile?: string }> {
    const first = args[0];
    if (first === '--profile' || first === '-p') {
        const profile = args[1];
        return profile ?
            { succeeded: true, result: { args: args.slice(2), profile } } :
            { succeeded: false, error: ['The Minikube profile flag requires a value.'] };
    }
    if (first?.startsWith('--profile=') || first?.startsWith('-p=')) {
        const profile = first.substring(first.indexOf('=') + 1);
        return profile ?
            { succeeded: true, result: { args: args.slice(1), profile } } :
            { succeeded: false, error: ['The Minikube profile flag requires a value.'] };
    }
    if (first?.startsWith('-p') && first.length > 2) {
        return { succeeded: true, result: { args: args.slice(1), profile: first.substring(2) } };
    }
    return { succeeded: true, result: { args } };
}

export function minikubeLifecycleArgs(command: 'status' | 'stop', profile?: string): string[] {
    return [...(profile ? ['--profile', profile] : []), command];
}

export function parseAdditionalFlags(value: string): Errorable<string[]> {
    if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) {
        return invalid('Control characters are not supported in additional flags.');
    }
    const args: string[] = [];
    let current = '';
    let quote: 'single' | 'double' | undefined;
    let tokenStarted = false;

    for (let index = 0; index < value.length; index++) {
        const character = value[index];
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

function isValidProfile(value: string): boolean {
    const label = '[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?';
    return value.length > 1 && new RegExp(`^(?:${label}\\.)*${label}$`).test(value);
}

function invalid(message: string): Errorable<string[]> {
    return { succeeded: false, error: [message] };
}
