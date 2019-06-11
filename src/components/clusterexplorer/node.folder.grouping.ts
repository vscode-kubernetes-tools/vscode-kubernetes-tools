import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import * as kuberesources from '../../kuberesources';
import { Host } from '../../host';
import { ClusterExplorerNode, ClusterExplorerGroupingFolderNode } from './node';
import { FolderNode } from './node.folder';
import { resourceFolderNodeCreate } from "./resourcefolderfactory";

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
            resourceFolderNodeCreate(kuberesources.allKinds.deployment),
            resourceFolderNodeCreate(kuberesources.allKinds.statefulSet),
            resourceFolderNodeCreate(kuberesources.allKinds.daemonSet),
            resourceFolderNodeCreate(kuberesources.allKinds.job),
            resourceFolderNodeCreate(kuberesources.allKinds.cronjob),
            resourceFolderNodeCreate(kuberesources.allKinds.pod),
        ];
    }
}

export class ConfigurationGroupingFolderNode extends GroupingFolderNode {
    constructor() {
        super("folder.grouping", "config", "Configuration");
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            resourceFolderNodeCreate(kuberesources.allKinds.configMap),
            resourceFolderNodeCreate(kuberesources.allKinds.secret)
        ];
    }
}

export class NetworkGroupingFolderNode extends GroupingFolderNode {
    constructor() {
        super("folder.grouping", "network", "Network");
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            resourceFolderNodeCreate(kuberesources.allKinds.service),
            resourceFolderNodeCreate(kuberesources.allKinds.endpoint),
            resourceFolderNodeCreate(kuberesources.allKinds.ingress),
        ];
    }
}

export class StorageGroupingFolderNode extends GroupingFolderNode {
    constructor() {
        super("folder.grouping", "storage", "Storage");
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            resourceFolderNodeCreate(kuberesources.allKinds.persistentVolume),
            resourceFolderNodeCreate(kuberesources.allKinds.persistentVolumeClaim),
            resourceFolderNodeCreate(kuberesources.allKinds.storageClass),
        ];
    }
}
