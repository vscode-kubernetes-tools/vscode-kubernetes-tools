import * as vscode from 'vscode';

import * as kuberesources from '../../kuberesources';
import { ObjectMeta, KubernetesResource } from '../../kuberesources.objectmodel';
import { ClusterExplorerResourceNode } from './node';
import { SimpleResourceNode, ResourceExtraInfo, ResourceNode, podUICustomiser, namespaceUICustomiser } from './node.resource';

export function resourceNodeCreate(kind: kuberesources.ResourceKind, name: string, metadata: ObjectMeta | undefined, extraInfo: ResourceExtraInfo | undefined): ClusterExplorerResourceNode {
    return new SimpleResourceNode(kind, name, metadata, extraInfo);
}

export function getChildSources(kind: kuberesources.ResourceKind): ReadonlyArray<ResourceChildSource> {
    const descriptor = specialKinds.find((d) => d.kind.manifestKind === kind.manifestKind);
    if (descriptor) {
        return descriptor.childSources || [];
    }
    return [];
}

export function getUICustomiser(kind: kuberesources.ResourceKind): ResourceUICustomiser {
    const descriptor = specialKinds.find((d) => d.kind.manifestKind === kind.manifestKind);
    if (descriptor) {
        return descriptor.uiCustomiser || NO_CUSTOMISER;
    }
    return NO_CUSTOMISER;
}

const NO_CUSTOMISER = {
    customiseTreeItem(_resource: ResourceNode, _treeItem: vscode.TreeItem): void {}
};

const specialKinds: ReadonlyArray<ResourceKindUIDescriptor> = [
    { kind: kuberesources.allKinds.namespace /*, lister: namespaceLister */, uiCustomiser: namespaceUICustomiser },
    { kind: kuberesources.allKinds.node /*, lister: nodeLister */, childSources: ['nodepods'] },
    { kind: kuberesources.allKinds.deployment, childSources: ['pods'] },
    { kind: kuberesources.allKinds.daemonSet, childSources: ['pods'] },
    { kind: kuberesources.allKinds.pod, childSources: ['podstatus'], uiCustomiser: podUICustomiser },
    { kind: kuberesources.allKinds.service, childSources: ['pods'] },
    { kind: kuberesources.allKinds.configMap, childSources: ['configdata'] },
    { kind: kuberesources.allKinds.secret, childSources: ['configdata'] },
    { kind: kuberesources.allKinds.statefulSet, childSources: ['pods'] },
];

interface ResourceKindUIDescriptor {
    readonly kind: kuberesources.ResourceKind;
    readonly lister?: ResourceLister;
    readonly childSources?: ReadonlyArray<ResourceChildSource>;
    readonly uiCustomiser?: ResourceUICustomiser;
}

export interface ResourceLister {
    list(parent: any): ReadonlyArray<KubernetesResource>;
}

export interface ResourceUICustomiser {
    customiseTreeItem(resource: ResourceNode, treeItem: vscode.TreeItem): void;
}

export type ResourceChildSource =
    'configdata' |
    'pods' |
    'podstatus' |
    'nodepods';
