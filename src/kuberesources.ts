import * as vscode from 'vscode';
import { Dictionary } from './utils/dictionary';

export class ResourceKind implements vscode.QuickPickItem {
    constructor(readonly displayName: string, readonly pluralDisplayName: string, readonly manifestKind: string, readonly abbreviation: string, readonly apiName?: string) {
    }

    get label() { return this.displayName; }
    get description() { return ''; }
}

export const allKinds: Dictionary<ResourceKind> = {
    endpoint: new ResourceKind("Endpoint", "Endpoints", "Endpoint", "endpoints", "endpoints"),
    namespace: new ResourceKind("Namespace", "Namespaces", "Namespace", "namespace" , "namespaces"),
    node: new ResourceKind("Node", "Nodes", "Node", "node", "nodes"),
    deployment: new ResourceKind("Deployment", "Deployments", "Deployment", "deployment", "deployments"),
    daemonSet: new ResourceKind("DaemonSet", "DaemonSets", "DaemonSet", "daemonset", "daemonsets"),
    replicaSet: new ResourceKind("ReplicaSet", "ReplicaSets", "ReplicaSet", "rs", "replicasets"),
    replicationController: new ResourceKind("Replication Controller", "Replication Controllers", "ReplicationController", "rc", "replicationcontrollers"),
    job: new ResourceKind("Job", "Jobs", "Job", "job", "jobs"),
    cronjob: new ResourceKind("CronJob", "CronJobs", "CronJob", "cronjob", "cronjobs"),
    pod: new ResourceKind("Pod", "Pods", "Pod", "pod", "pods"),
    crd: new ResourceKind("Custom Resource", "Custom Resources", "CustomResourceDefinition", "crd", "customresources"),
    service: new ResourceKind("Service", "Services", "Service", "service", "services"),
    configMap: new ResourceKind("ConfigMap", "Config Maps", "ConfigMap", "configmap", "configmaps"),
    secret: new ResourceKind("Secret", "Secrets", "Secret", "secret", "secrets"),
    ingress: new ResourceKind("Ingress", "Ingress", "Ingress", "ingress", "ingress"),
    persistentVolume: new ResourceKind("Persistent Volume", "Persistent Volumes", "PersistentVolume", "pv", "persistentvolumes"),
    persistentVolumeClaim: new ResourceKind("Persistent Volume Claim", "Persistent Volume Claims", "PersistentVolumeClaim", "pvc", "persistentvolumeclaims"),
    storageClass: new ResourceKind("Storage Class", "Storage Classes", "StorageClass", "sc", "storageclasses"),
    statefulSet: new ResourceKind("StatefulSet", "StatefulSets", "StatefulSet", "statefulset", "statefulsets")
};

export const commonKinds = [
    allKinds.deployment,
    allKinds.job,
    allKinds.pod,
    allKinds.service,
];

export const scaleableKinds = [
    allKinds.deployment,
    allKinds.replicaSet,
    allKinds.replicationController,
    allKinds.job,
    allKinds.statefulSet,
];

export const exposableKinds = [
    allKinds.deployment,
    allKinds.pod,
    allKinds.replicationController,
    allKinds.replicaSet,
    allKinds.service,
];

export function findKind(manifestKind: string): ResourceKind | undefined {
    for (const k in allKinds) {
        if (allKinds[k].manifestKind === manifestKind) {
            return allKinds[k];
        }
    }
    return undefined;
}
