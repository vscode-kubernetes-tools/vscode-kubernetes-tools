export interface KubernetesResource {
    readonly kind: string;
    readonly metadata: ObjectMeta;
}

export interface KubernetesCollection<T extends KubernetesResource> {
    readonly items: T[];
}

export interface ObjectMeta {
    readonly name: string;
    readonly namespace?: string;
    readonly labels?: KeyValuePairs;
}

export interface KeyValuePairs {
    readonly [key: string]: string;
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

export interface CRD extends KubernetesResource {
    readonly spec: CRDSpec;
}

export interface CRDSpec {
    readonly names: CRDNames;
}

export interface CRDNames {
    readonly kind: string;
    readonly plural: string;
    readonly singular: string;
    readonly shortNames: string[];
}

function isObjectMeta(obj: any): obj is ObjectMeta {
    return obj && obj.name;
}

export function isKubernetesResource(obj: any): obj is KubernetesResource {
    return obj && obj.kind && isObjectMeta(obj.metadata);
}

export function isPod(obj: any): obj is Pod {
    return isKubernetesResource(obj) && obj.kind === 'Pod';
}
