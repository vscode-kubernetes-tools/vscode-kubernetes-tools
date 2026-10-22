import { Kubectl } from '../../kubectl';
import { ExecResult } from '../../binutilplusplus';
import { Errorable, failed } from '../../errorable';
import { Container, KubernetesCollection, Pod } from '../../kuberesources.objectmodel';
import type { ContainerContainer } from '../../utils/containercontainer';

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
