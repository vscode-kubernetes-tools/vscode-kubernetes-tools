import * as vscode from 'vscode';

export class ResourceKind implements vscode.QuickPickItem {
    constructor(readonly displayName: string, readonly pluralDisplayName: string, readonly abbreviation: string) {
    }

    get label() { return this.displayName; }
    get description() { return ''; }
}

export const allKinds = {
    namespace: new ResourceKind("Namespace", "Namespaces", "namespace"),
    node: new ResourceKind("Node", "Nodes", "node"),
    deployment: new ResourceKind("Deployment", "Deployments", "deployment"),
    replicaSet: new ResourceKind("ReplicaSet", "ReplicaSets", "rs"),
    replicationController: new ResourceKind("Replication Controller", "Replication Controllers", "rc"),
    job: new ResourceKind("Job", "Jobs", "job"),
    pod: new ResourceKind("Pod", "Pods", "pod"),
    service: new ResourceKind("Service", "Services", "service"),
    configMap: new ResourceKind("ConfigMap", "ConfigMaps", "configmap"),
    secret: new ResourceKind("Secret", "Secrets", "secret"),
    ingress: new ResourceKind("Ingress", "Ingress", "ingress"),
    route: new ResourceKind("Routes", "Routes", "routes" )
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
