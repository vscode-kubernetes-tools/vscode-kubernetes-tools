import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import * as kuberesources from '../../kuberesources';
import { Host } from '../../host';
import { ClusterExplorerGroupingFolderNode, ClusterExplorerNode } from './node';
import { FolderNode } from './node.folder';
import { ResourceFolderNode } from './node.folder.resource';
import { NODE_TYPES } from './explorer';

export abstract class GroupingFolderNode extends FolderNode implements ClusterExplorerGroupingFolderNode {
    static of(id: string, displayName: string, ...kinds: kuberesources.ResourceKind[]): GroupingFolderNode {
        return new ResourceKindsGroupingFolder(id, displayName, kinds);
    }

    constructor(id: string, displayName: string, contextValue?: string) {
        super(NODE_TYPES.folder.grouping, id, displayName, contextValue);
    }
    readonly nodeType = NODE_TYPES.folder.grouping;
}

export const workloadsGroupingFolder = () =>
    GroupingFolderNode.of("workload", "Workloads",
        kuberesources.allKinds.deployment,
        kuberesources.allKinds.statefulSet,
        kuberesources.allKinds.daemonSet,
        kuberesources.allKinds.job,
        kuberesources.allKinds.cronjob,
        kuberesources.allKinds.pod,
    );

class ResourceKindsGroupingFolder extends GroupingFolderNode {
    constructor(id: string, displayName: string, private readonly kinds: kuberesources.ResourceKind[]) {
        super(id, displayName);
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return this.kinds.map((k) => ResourceFolderNode.create(k));
    }
}

export const configurationGroupingFolder = () =>
    GroupingFolderNode.of("config", "Configuration",
        kuberesources.allKinds.configMap,
        kuberesources.allKinds.secret,
    );

export const networkGroupingFolder = () =>
    GroupingFolderNode.of("network", "Network",
        kuberesources.allKinds.service,
        kuberesources.allKinds.endpoint,
        kuberesources.allKinds.ingress,
    );

export const storageGroupingFolder = () =>
    GroupingFolderNode.of("storage", "Storage",
        kuberesources.allKinds.persistentVolume,
        kuberesources.allKinds.persistentVolumeClaim,
        kuberesources.allKinds.storageClass,
    );
