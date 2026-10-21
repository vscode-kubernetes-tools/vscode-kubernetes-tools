export interface KubernetesResource {
    readonly kind: string;
    readonly metadata: ObjectMeta;
}

export interface KubernetesCollection<T extends KubernetesResource> {
    readonly items: T[];
}

export interface ObjectMeta {
    readonly name: string;
    readonly namespace: string;
    readonly labels?: KeyValuePairs;
}

export interface KeyValuePairs {
    [key: string]: string;
}

export interface DataResource extends KubernetesResource {
    readonly data: KeyValuePairs;
}

export interface Namespace extends KubernetesResource {
}

export interface LivenessProbeHttpGet {
    readonly path: string;
    readonly port: number;
    readonly scheme: string;
}

export interface LivenessProbe {
    readonly httpGet: LivenessProbeHttpGet;
}

export interface Container {
    readonly name: string;
    readonly image: string;
    readonly livenessProbe?: LivenessProbe;
    readonly initContainer: boolean;
}

export interface Pod extends KubernetesResource {
    readonly spec: PodSpec;
    readonly status: PodStatus;
}

export interface Node extends KubernetesResource {
}

export interface PodSpec {
    readonly containers: Container[];
    readonly nodeName: string;
}

export interface PodStatus {
    readonly podIP: string;
    readonly phase: string;
    readonly containerStatuses: ContainerStatus[];
}

export interface ContainerStatus {
    readonly ready: boolean;
}

function isObjectMeta(obj: any): obj is ObjectMeta {
    return obj && typeof obj.name === 'string' &&
        (obj.namespace === undefined || typeof obj.namespace === 'string');
}

export function isKubernetesResource(obj: any): obj is KubernetesResource {
    return obj && typeof obj.kind === 'string' && isObjectMeta(obj.metadata);
}

export function isKubernetesCollection<T extends KubernetesResource>(obj: any): obj is KubernetesCollection<T> {
    return obj && Array.isArray(obj.items) && obj.items.every(isKubernetesResource);
}

export function isPod(obj: any): obj is Pod {
    return isKubernetesResource(obj) && obj.kind === 'Pod';
}
