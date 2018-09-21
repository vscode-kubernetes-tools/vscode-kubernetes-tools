import * as vscode from 'vscode';

export class ResourceKind implements vscode.QuickPickItem {
    constructor(readonly displayName: string, readonly pluralDisplayName: string, readonly manifestKind: string, readonly abbreviation: string) {
    }

    get label() { return this.displayName; }
    get description() { return ''; }
}

export const allKinds = {
    endpoint: new ResourceKind("Endpoint", "Endpoints", "Endpoint", "endpoints"),
    namespace: new ResourceKind("Namespace", "Namespaces", "Namespace", "namespace"),
    node: new ResourceKind("Node", "Nodes", "Node", "node"),
    deployment: new ResourceKind("Deployment", "Deployments", "Deployment", "deployment"),
    daemonSet: new ResourceKind("DaemonSet", "DaemonSets", "DaemonSet", "daemonset"),
    replicaSet: new ResourceKind("ReplicaSet", "ReplicaSets", "ReplicaSet", "rs"),
    replicationController: new ResourceKind("Replication Controller", "Replication Controllers", "ReplicationController", "rc"),
    job: new ResourceKind("Job", "Jobs", "Job", "job"),
    cronjob: new ResourceKind("CronJob", "CronJobs", "CronJob", "cronjob"),
    pod: new ResourceKind("Pod", "Pods", "Pod", "pod"),
    service: new ResourceKind("Service", "Services", "Service", "service"),
    configMap: new ResourceKind("ConfigMap", "Config Maps", "ConfigMap", "configmap"),
    secret: new ResourceKind("Secret", "Secrets", "Secret", "secret"),
    ingress: new ResourceKind("Ingress", "Ingress", "Ingress", "ingress"),
    persistentVolume: new ResourceKind("Persistent Volume", "Persistent Volumes", "PersistentVolume", "pv"),
    persistentVolumeClaim: new ResourceKind("Persistent Volume Claim", "Persistent Volume Claims", "PersistentVolumeClaim", "pvc"),
    storageClass: new ResourceKind("Storage Class", "Storage Classes", "StorageClass", "sc"),
    statefulSet: new ResourceKind("StatefulSet", "Stateful Sets", "StatefulSet", "statefulset"),
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
