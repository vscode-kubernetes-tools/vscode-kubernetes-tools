import { Container, Pod } from '../../kuberesources.objectmodel';
import { containerExecArgs, isValidPodName } from './pod-commands';
import { isSafeNamespace } from './resource-commands';

export interface ContainerExecTarget {
    readonly name: string;
    readonly namespace?: string;
    readonly spec?: Pod['spec'];
}

export interface ContainerExecDependencies {
    readonly prompt: (interactive: boolean) => Promise<string | undefined>;
    readonly selectPod: () => Promise<Pod | null>;
    readonly selectContainer: (pod: ContainerExecTarget) => Promise<Container | null>;
    readonly suggestedShell: (pod: ContainerExecTarget, container: Container) => Promise<string>;
    readonly invoke: (args: readonly string[], name: string) => Promise<void>;
    readonly showError: (message: string) => Thenable<unknown>;
}

// This is argument tokenization, not shell parsing. Preserve Windows paths and
// literal variable/substitution text; shell operators require an explicit remote shell.
export function parseContainerCommand(value: string): string[] | undefined {
    if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) {
        return undefined;
    }
    const args: string[] = [];
    let current = '';
    let quote: string | undefined;
    let started = false;
    for (let index = 0; index < value.length; index++) {
        const character = value[index];
        if (!quote && /\s/.test(character)) {
            if (started) {
                args.push(current);
                current = '';
                started = false;
            }
        } else if (character === quote) {
            quote = undefined;
        } else if (!quote && (character === '"' || character === "'")) {
            quote = character;
            started = true;
        } else if (character === '\\' && quote !== "'" &&
            (value[index + 1] === '"' || (!quote && !!value[index + 1] && /\s/.test(value[index + 1])))) {
            current += value[++index];
            started = true;
        } else if (!quote && /[;&|<>`]/.test(character)) {
            return undefined;
        } else {
            current += character;
            started = true;
        }
    }
    if (quote) {
        return undefined;
    }
    if (started) {
        args.push(current);
    }
    return args.length > 0 && args[0].length > 0 ? args : undefined;
}

function validTarget(target: ContainerExecTarget): boolean {
    return isValidPodName(target.name) &&
        (target.namespace === undefined || target.namespace === '' ||
            (typeof target.namespace === 'string' && isSafeNamespace(target.namespace)));
}

export async function containerExec(
    interactive: boolean,
    dependencies: ContainerExecDependencies,
    explorerTarget?: ContainerExecTarget
): Promise<void> {
    let command: string[] | undefined;
    if (!explorerTarget) {
        const prompted = await dependencies.prompt(interactive);
        if (prompted === undefined || prompted === '') {
            return;
        }
        command = parseContainerCommand(prompted);
        if (!command) {
            await dependencies.showError('Invalid container command. Use quoted arguments; shell operators require an explicit remote shell (for example, sh -c "echo hello | cat").');
            return;
        }
    }
    const pod = explorerTarget ? undefined : await dependencies.selectPod();
    const selected = explorerTarget || (pod?.metadata ? { ...pod.metadata, spec: pod.spec } : undefined);
    if (!selected) {
        return;
    }
    if (!validTarget(selected)) {
        await dependencies.showError('Invalid Kubernetes pod or namespace.');
        return;
    }
    const container = await dependencies.selectContainer(selected);
    if (!container) {
        return;
    }
    if (typeof container.name !== 'string' || container.name.length > 63 ||
        !/^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/.test(container.name)) {
        await dependencies.showError('Invalid Kubernetes container name.');
        return;
    }
    // Suggested shells are already structured values, never prompt text.
    command ||= [await dependencies.suggestedShell(selected, container)];
    const args = containerExecArgs(selected.name, selected.namespace, container.name, command);
    if (interactive) {
        args.splice(1, 0, '-it');
    }
    await dependencies.invoke(args, `${command[0]} on ${selected.name}/${container.name}`);
}
