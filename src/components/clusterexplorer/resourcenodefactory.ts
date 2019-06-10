import * as vscode from 'vscode';

import * as kubectlUtils from '../../kubectlUtils';
import * as kuberesources from '../../kuberesources';
import { ObjectMeta, KubernetesResource } from '../../kuberesources.objectmodel';
import { ClusterExplorerResourceNode } from './node';
import { NamespaceResourceNode } from './node.resource.namespace';
import { SimpleResourceNode, podIconProvider, ResourceExtraInfo } from './node.resource';

export function resourceNodeCreate(kind: kuberesources.ResourceKind, name: string, metadata: ObjectMeta | undefined, extraInfo: ResourceExtraInfo | kubectlUtils.NamespaceInfo /* for now */ | undefined): ClusterExplorerResourceNode {
    if (kind.manifestKind === 'Namespace') {
        return new NamespaceResourceNode(name, metadata, extraInfo as kubectlUtils.NamespaceInfo);
    }
    return new SimpleResourceNode(kind, name, metadata, extraInfo as ResourceExtraInfo | undefined);  // TODO: get rid of type assertion
}

export function getChildSources(kind: kuberesources.ResourceKind): ReadonlyArray<ResourceChildSource> {
    const descriptor = specialKinds.find((d) => d.kind.manifestKind === kind.manifestKind);
    if (descriptor) {
        return descriptor.childSources || [];
    }
    return [];
}

export function getIconProvider(kind: kuberesources.ResourceKind): ResourceIconProvider | undefined {
    const descriptor = specialKinds.find((d) => d.kind.manifestKind === kind.manifestKind);
    if (descriptor) {
        return descriptor.iconProvider;
    }
    return undefined;
}

const specialKinds: ReadonlyArray<ResourceKindUIDescriptor> = [
    { kind: kuberesources.allKinds.namespace /*, lister: namespaceLister */ },
    { kind: kuberesources.allKinds.node /*, lister: nodeLister */, childSources: ['nodepods'] },
    { kind: kuberesources.allKinds.deployment, childSources: ['pods'] },
    { kind: kuberesources.allKinds.daemonSet, childSources: ['pods'] },
    { kind: kuberesources.allKinds.pod, childSources: ['podstatus'], iconProvider: podIconProvider },
    { kind: kuberesources.allKinds.service, childSources: ['pods'] },
    { kind: kuberesources.allKinds.configMap, childSources: ['configdata'] },
    { kind: kuberesources.allKinds.secret, childSources: ['configdata'] },
    { kind: kuberesources.allKinds.statefulSet, childSources: ['pods'] },
];

interface ResourceKindUIDescriptor {
    readonly kind: kuberesources.ResourceKind;
    readonly lister?: ResourceLister;
    readonly childSources?: ReadonlyArray<ResourceChildSource>;
    readonly iconProvider?: ResourceIconProvider;
}

export interface ResourceLister {
    list(parent: any): ReadonlyArray<KubernetesResource>;
}

export interface ResourceIconProvider {
    iconPath(resource: ClusterExplorerResourceNode): vscode.Uri | undefined;
}

export type ResourceChildSource =
    'configdata' |
    'pods' |
    'podstatus' |
    'nodepods';
