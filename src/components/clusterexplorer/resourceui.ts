import * as vscode from 'vscode';

import * as kuberesources from '../../kuberesources';
import { ClusterExplorerNode } from './node';
import { ResourceNode } from './node.resource';
import { namespaceUICustomiser, namespaceLister } from './resourcekinds/resourcekind.namespace';
import { podUICustomiser, podStatusChildSource, podLister } from './resourcekinds/resourcekind.pod';
import { Kubectl } from '../../kubectl';
import { selectedPodsChildSource, hasSelectorLister } from './resourcekinds/resourcekinds.selectspods';
import { nodePodsChildSource } from './resourcekinds/resourcekind.node';
import { configItemsChildSource, configResourceLister } from './resourcekinds/resourcekinds.configuration';

const specialKinds: ReadonlyArray<ResourceKindUIDescriptor> = [
    { kind: kuberesources.allKinds.namespace, lister: namespaceLister, uiCustomiser: namespaceUICustomiser },
    { kind: kuberesources.allKinds.node, childSources: [nodePodsChildSource] },
    { kind: kuberesources.allKinds.deployment, lister: hasSelectorLister, childSources: [selectedPodsChildSource] },
    { kind: kuberesources.allKinds.daemonSet, lister: hasSelectorLister, childSources: [selectedPodsChildSource] },
    { kind: kuberesources.allKinds.job, lister: hasSelectorLister, childSources: [selectedPodsChildSource] },
    { kind: kuberesources.allKinds.pod, lister: podLister, childSources: [podStatusChildSource], uiCustomiser: podUICustomiser },
    { kind: kuberesources.allKinds.service, lister: hasSelectorLister, childSources: [selectedPodsChildSource] },
    { kind: kuberesources.allKinds.configMap, lister: configResourceLister, childSources: [configItemsChildSource] },
    { kind: kuberesources.allKinds.secret, lister: configResourceLister, childSources: [configItemsChildSource] },
    { kind: kuberesources.allKinds.statefulSet, lister: hasSelectorLister, childSources: [selectedPodsChildSource] },
];

export function getLister(kind: kuberesources.ResourceKind): ResourceLister | undefined {
    const descriptor = specialKinds.find((d) => d.kind.manifestKind === kind.manifestKind);
    if (descriptor) {
        return descriptor.lister;
    }
    return undefined;
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

interface ResourceKindUIDescriptor {
    readonly kind: kuberesources.ResourceKind;
    readonly lister?: ResourceLister;
    readonly childSources?: ReadonlyArray<ResourceChildSource>;
    readonly uiCustomiser?: ResourceUICustomiser;
}

export interface ResourceLister {
    list(kubectl: Kubectl, kind: kuberesources.ResourceKind): Promise<ClusterExplorerNode[]>;
}

export interface ResourceUICustomiser {
    customiseTreeItem(resource: ResourceNode, treeItem: vscode.TreeItem): void;
}

export interface ResourceChildSource {
    children(kubectl: Kubectl, parent: ResourceNode): Promise<ClusterExplorerNode[]>;
}
