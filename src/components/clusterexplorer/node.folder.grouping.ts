import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import * as kuberesources from '../../kuberesources';
import { Host } from '../../host';
import { ClusterExplorerNode } from './node';
import { FolderNode } from './node.folder';
import { KubernetesSelectsPodsFolder, KubernetesResourceFolder, KubernetesDataHolderFolder } from './explorer';

export class WorkloadsGroupingFolderNode extends FolderNode {
    constructor() {
        super("folder.grouping", "workload", "Workloads");
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            new KubernetesSelectsPodsFolder(kuberesources.allKinds.deployment),
            new KubernetesSelectsPodsFolder(kuberesources.allKinds.statefulSet),
            new KubernetesSelectsPodsFolder(kuberesources.allKinds.daemonSet),
            new KubernetesResourceFolder(kuberesources.allKinds.job),
            new KubernetesResourceFolder(kuberesources.allKinds.cronjob),
            new KubernetesResourceFolder(kuberesources.allKinds.pod),
        ];
    }
}

export class ConfigurationGroupingFolderNode extends FolderNode {
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

export class NetworkGroupingFolderNode extends FolderNode {
    constructor() {
        super("folder.grouping", "network", "Network");
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            new KubernetesSelectsPodsFolder(kuberesources.allKinds.service),
            new KubernetesResourceFolder(kuberesources.allKinds.endpoint),
            new KubernetesResourceFolder(kuberesources.allKinds.ingress),
        ];
    }
}

export class StorageGroupingFolderNode extends FolderNode {
    constructor() {
        super("folder.grouping", "storage", "Storage");
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            new KubernetesResourceFolder(kuberesources.allKinds.persistentVolume),
            new KubernetesResourceFolder(kuberesources.allKinds.persistentVolumeClaim),
            new KubernetesResourceFolder(kuberesources.allKinds.storageClass),
        ];
    }
}
