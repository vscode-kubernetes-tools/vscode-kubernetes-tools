import { Container } from "../kuberesources.objectmodel";
import * as explorer from "../components/clusterexplorer/explorer";
import { PodSummary } from "../extension";

// Represents a Kubernetes resource that contains a collection of (Docker) containers -
// specifically a pod or a job.
//
// Yes, I would like a better name for it!
export interface ContainerContainer {
    readonly kindName: string;
    readonly namespace: string | undefined;
    readonly containers?: Container[];
    readonly containersQueryPath: string;
}

export module ContainerContainer {

    export function fromNode(explorerNode: explorer.ResourceNode): ContainerContainer | undefined {
        const queryPath = containersQueryPath(explorerNode);
        if (!queryPath) {
            return undefined;
        }
        return { kindName: explorerNode.resourceId, namespace: explorerNode.namespace || undefined, containersQueryPath: queryPath };
    }

    export function fromPod(pod: PodSummary): ContainerContainer {
        return {
            kindName: `pod/${pod.name}`,
            namespace: pod.namespace || undefined,
            containers: pod.spec ? pod.spec.containers : undefined,
            containersQueryPath: '.spec'
        };
    }

    function containersQueryPath(explorerNode: explorer.ResourceNode): string | undefined {
        const kind = explorerNode.resourceId.substring(0, explorerNode.resourceId.indexOf('/'));
        switch (kind) {
            case 'pod': return '.spec';
            case 'job': return '.spec.template.spec';
            default: return undefined;
        }
    }

}
