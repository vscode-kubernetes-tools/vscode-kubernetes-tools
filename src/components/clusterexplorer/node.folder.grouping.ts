import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import * as kuberesources from '../../kuberesources';
import { Host } from '../../host';
import { ClusterExplorerNode, ClusterExplorerGroupingFolderNode } from './node';
import { FolderNode } from './node.folder';
import { KubernetesSelectsPodsFolder, KubernetesDataHolderFolder } from './explorer';
import { ResourceFolderNode } from "./node.folder.resource";

export abstract class GroupingFolderNode extends FolderNode implements ClusterExplorerGroupingFolderNode {
    constructor(nodeType: 'folder.grouping', id: string, displayName: string, contextValue?: string) {
        super(nodeType, id, displayName, contextValue);
    }
    readonly nodeType = 'folder.grouping';
}

export class WorkloadsGroupingFolderNode extends GroupingFolderNode {
    constructor() {
        super("folder.grouping", "workload", "Workloads");
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            new KubernetesSelectsPodsFolder(kuberesources.allKinds.deployment),
            new KubernetesSelectsPodsFolder(kuberesources.allKinds.statefulSet),
            new KubernetesSelectsPodsFolder(kuberesources.allKinds.daemonSet),
            new ResourceFolderNode(kuberesources.allKinds.job),
            new ResourceFolderNode(kuberesources.allKinds.cronjob),
            new ResourceFolderNode(kuberesources.allKinds.pod),
        ];
    }
}

export class ConfigurationGroupingFolderNode extends GroupingFolderNode {
    constructor() {
        super("folder.grouping", "config", "Configuration");
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            new KubernetesDataHolderFolder(kuberesources.allKinds.configMap),
            new KubernetesDataHolderFolder(kuberesources.allKinds.secret)
        ];
    }
}

export class NetworkGroupingFolderNode extends GroupingFolderNode {
    constructor() {
        super("folder.grouping", "network", "Network");
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            new KubernetesSelectsPodsFolder(kuberesources.allKinds.service),
            new ResourceFolderNode(kuberesources.allKinds.endpoint),
            new ResourceFolderNode(kuberesources.allKinds.ingress),
        ];
    }
}

export class StorageGroupingFolderNode extends GroupingFolderNode {
    constructor() {
        super("folder.grouping", "storage", "Storage");
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            new ResourceFolderNode(kuberesources.allKinds.persistentVolume),
            new ResourceFolderNode(kuberesources.allKinds.persistentVolumeClaim),
            new ResourceFolderNode(kuberesources.allKinds.storageClass),
        ];
    }
}
