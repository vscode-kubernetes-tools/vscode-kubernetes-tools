import * as vscode from 'vscode';

import * as kubectlUtils from '../../kubectlUtils';
import * as kuberesources from '../../kuberesources';
import { ObjectMeta, DataResource, KubernetesResource } from '../../kuberesources.objectmodel';
import { ClusterExplorerResourceNode } from './node';
import { NodeClusterExplorerNode } from './node.resource.node';
import { NamespaceResourceNode } from './node.resource.namespace';
import { ConfigurationResourceNode } from './node.resource.configuration';
import { PodResourceNode, PodSelectingResourceNode, SimpleResourceNode, podIconProvider } from './node.resource';

export function resourceNodeCreate(kind: kuberesources.ResourceKind, name: string, metadata: ObjectMeta | undefined, resource: kubectlUtils.PodInfo | kubectlUtils.NamespaceInfo | DataResource | kubectlUtils.HasSelector | undefined): ClusterExplorerResourceNode {
    if (kind.manifestKind === 'Pod') {
        return new PodResourceNode(name, metadata, resource as kubectlUtils.PodInfo);
    }
    if (kind.manifestKind === 'Node') {
        return new NodeClusterExplorerNode(name, metadata);
    }
    if (kind.manifestKind === 'Namespace') {
        return new NamespaceResourceNode(name, metadata, resource as kubectlUtils.NamespaceInfo);
    }
    if (kind.holdsConfigData) {
        return new ConfigurationResourceNode(kind, name, metadata, (resource as DataResource).data);
    }
    if (kind.selectsPods) {
        return new PodSelectingResourceNode(kind, name, metadata, (resource as kubectlUtils.HasSelector).selector);
    }
    return new SimpleResourceNode(kind, name, metadata);
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
    { kind: kuberesources.allKinds.node /*, lister: nodeLister */ },
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
    'podstatus';
