import { Kubectl } from '../../kubectl';
import { ExecResult } from '../../binutilplusplus';
import { Errorable, failed } from '../../errorable';
import { Container, KubernetesCollection, Pod } from '../../kuberesources.objectmodel';
import type { ContainerContainer } from '../../utils/containercontainer';
import { isSafeNamespace } from './resource-commands';

export type PodQueryOptions = {
    readonly namespace?: string;
    readonly allNamespaces?: false;
} | {
    readonly allNamespaces: true;
    readonly namespace?: never;
};

export function podTableArgs(selector: unknown, namespace: string, allNamespaces: boolean): string[] | undefined {
    if (typeof namespace !== 'string' || (!allNamespaces && namespace !== '' && !isSafeNamespace(namespace))) {
        return undefined;
    }
    // Pod and Node views deliberately use null for an unfiltered list.
    const labels = selector === null || selector === undefined ? '' : podSelectorString(selector);
    if (labels === undefined) {
        return undefined;
    }
    return [
        'get', 'pods', '-o', 'wide',
        ...(allNamespaces ? ['--all-namespaces'] : namespace ? [`--namespace=${namespace}`] : []),
        ...(labels ? [`--selector=${labels}`] : []),
    ];
}

function podSelectorString(selector: unknown): string | undefined {
    if (!isRecord(selector) || Object.keys(selector).some((key) => key !== 'matchLabels' && key !== 'matchExpressions')) {
        return undefined;
    }
    const labels = selector.matchLabels ?? {};
    const expressions = selector.matchExpressions ?? [];
    if (!isRecord(labels) || !Array.isArray(expressions)) {
        return undefined;
    }

    const requirements: string[] = [];
    for (const [key, value] of Object.entries(labels)) {
        if (!isLabelKey(key) || !isLabelValue(value)) {
            return undefined;
        }
        requirements.push(`${key}=${value}`);
    }
    for (const expression of expressions) {
        if (!isRecord(expression) || !isLabelKey(expression.key) ||
            Object.keys(expression).some((key) => key !== 'key' && key !== 'operator' && key !== 'values')) {
            return undefined;
        }
        const values = expression.values ?? [];
        if (!Array.isArray(values) || !values.every(isLabelValue)) {
            return undefined;
        }
        switch (expression.operator) {
            case 'In':
            case 'NotIn':
                if (values.length === 0) {
                    return undefined;
                }
                requirements.push(`${expression.key} ${expression.operator === 'In' ? 'in' : 'notin'} (${values.join(',')})`);
                break;
            case 'Exists':
            case 'DoesNotExist':
                if (values.length !== 0) {
                    return undefined;
                }
                requirements.push(`${expression.operator === 'DoesNotExist' ? '!' : ''}${expression.key}`);
                break;
            default:
                return undefined;
        }
    }
    return requirements.join(',');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLabelKey(value: unknown): value is string {
    if (typeof value !== 'string' || value.length > 253 + 1 + 63) {
        return false;
    }
    const parts = value.split('/');
    return parts.length === 1 ? isLabelName(parts[0]) :
        parts.length === 2 && isDNSSubdomain(parts[0]) && isLabelName(parts[1]);
}

function isLabelName(value: string): boolean {
    return value.length > 0 && value.length <= 63 && /^[A-Za-z0-9](?:[-A-Za-z0-9_.]*[A-Za-z0-9])?$/.test(value);
}

function isLabelValue(value: unknown): value is string {
    return typeof value === 'string' && (value === '' || isLabelName(value));
}

function isDNSSubdomain(value: string): boolean {
    return value.length > 0 && value.length <= 253 &&
        /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?(?:\.[a-z0-9](?:[-a-z0-9]*[a-z0-9])?)*$/.test(value);
}

export function isValidPodName(value: unknown): value is string {
    return typeof value === 'string' && isDNSSubdomain(value);
}

export function containerExecArgs(pod: string, namespace: string | undefined, container: string | undefined, command: readonly string[]): string[] {
    return [
        'exec', `pod/${pod}`,
        ...(namespace ? [`--namespace=${namespace}`] : []),
        ...(container ? [`--container=${container}`] : []),
        '--', ...command,
    ];
}

export async function listPods(kubectl: Kubectl, selector?: string): Promise<Errorable<KubernetesCollection<Pod>>> {
    const parsed = await readJSON<KubernetesCollection<Pod>>(kubectl, ['get', 'pods', '-o', 'json', ...(selector === undefined ? [] : [`--selector=${selector}`])]);
    if (failed(parsed)) {
        return parsed;
    }
    if (!parsed.result || !Array.isArray(parsed.result.items) || !parsed.result.items.every(isPod)) {
        return { succeeded: false, error: ['The Kubernetes endpoint returned an invalid pod list.'] };
    }
    return parsed;
}

export async function readPod(kubectl: Kubectl, pod: string, namespace?: string): Promise<Errorable<Pod>> {
    const parsed = await readJSON<Pod>(kubectl, [
        'get', `pod/${pod}`, '-o', 'json', ...(namespace ? [`--namespace=${namespace}`] : []),
    ]);
    if (failed(parsed)) {
        return parsed;
    }
    return isPod(parsed.result) ? parsed : { succeeded: false, error: ['The Kubernetes endpoint returned an invalid pod.'] };
}

function isPod(value: unknown): value is Pod {
    const pod = value as Pod | null;
    return !!pod && typeof pod.metadata?.name === 'string' && pod.metadata.name.length > 0 &&
        (pod.metadata.namespace === undefined || typeof pod.metadata.namespace === 'string') &&
        Array.isArray(pod.spec?.containers) && pod.spec.containers.every((container) =>
            container && typeof container.name === 'string' && container.name.length > 0 && typeof container.image === 'string');
}

async function readJSON<T>(kubectl: Kubectl, args: string[]): Promise<Errorable<T>> {
    const result = await kubectl.invokeCommandArgs(args);
    try {
        return kubectl.parseJSON<T>(result);
    } catch {
        return { succeeded: false, error: ['The Kubernetes endpoint returned invalid JSON.'] };
    }
}

export async function queryContainers(kubectl: Kubectl, resource: ContainerContainer, type: 'containers' | 'initContainers'): Promise<Errorable<Container[]>> {
    const query = `{range ${resource.containersQueryPath}.${type}[*]}{.name}{"\\t"}{.image}{"\\n"}{end}`;
    const result = await kubectl.invokeCommandArgs([
        'get', resource.kindName, '-o', `jsonpath=${query}`,
        ...(resource.namespace ? [`--namespace=${resource.namespace}`] : []),
    ]);
    if (ExecResult.failed(result)) {
        return { succeeded: false, error: [ExecResult.failureMessage(result, {})] };
    }
    return {
        succeeded: true,
        result: result.stdout.split(/\r?\n/).filter((line) => line.length > 0).map((line) => {
            const [name, image] = line.split('\t');
            return { name: name.trim(), image: image?.trim() || '', initContainer: type === 'initContainers' };
        }).filter((container) => container.name.length > 0),
    };
}
