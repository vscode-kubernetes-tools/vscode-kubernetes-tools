import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import * as kuberesources from '../../kuberesources';
import { Host } from '../../host';
import { ClusterExplorerNode, ClusterExplorerGroupingFolderNode } from './node';
import { FolderNode } from './node.folder';
import { ResourceFolderNode } from './node.folder.resource';

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
            ResourceFolderNode.create(kuberesources.allKinds.deployment),
            ResourceFolderNode.create(kuberesources.allKinds.statefulSet),
            ResourceFolderNode.create(kuberesources.allKinds.daemonSet),
            ResourceFolderNode.create(kuberesources.allKinds.job),
            ResourceFolderNode.create(kuberesources.allKinds.cronjob),
            ResourceFolderNode.create(kuberesources.allKinds.pod),
        ];
    }
}

export class ConfigurationGroupingFolderNode extends GroupingFolderNode {
    constructor() {
        super("folder.grouping", "config", "Configuration");
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            ResourceFolderNode.create(kuberesources.allKinds.configMap),
            ResourceFolderNode.create(kuberesources.allKinds.secret)
        ];
    }
}

export class NetworkGroupingFolderNode extends GroupingFolderNode {
    constructor() {
        super("folder.grouping", "network", "Network");
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            ResourceFolderNode.create(kuberesources.allKinds.service),
            ResourceFolderNode.create(kuberesources.allKinds.endpoint),
            ResourceFolderNode.create(kuberesources.allKinds.ingress),
        ];
    }
}

export class StorageGroupingFolderNode extends GroupingFolderNode {
    constructor() {
        super("folder.grouping", "storage", "Storage");
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            ResourceFolderNode.create(kuberesources.allKinds.persistentVolume),
            ResourceFolderNode.create(kuberesources.allKinds.persistentVolumeClaim),
            ResourceFolderNode.create(kuberesources.allKinds.storageClass),
        ];
    }
}
