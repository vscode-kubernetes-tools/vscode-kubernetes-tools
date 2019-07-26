import * as kuberesources from '../../kuberesources';
import { ExplorerExtender } from './explorer.extension';
import { ClusterExplorerNode, ClusterExplorerResourceNode } from './node';
import { ContributedGroupingFolderNode } from './node.folder.grouping.custom';
import { ResourceFolderNode, ResourceNodeHelper } from './node.folder.resource';
import { NODE_TYPES } from './explorer';
import { ResourceNode } from './node.resource';
import { ResourceLister } from './resourceui';
import { Kubectl } from '../../kubectl';
import { Host } from '../../host';

// This module contains 'node sources' - built-in ways of creating nodes of
// *built-in* types (as opposed to the completely custom nodes created by an
// ExplorerExtender).  Node sources can be consumed and composed through the API
// to build trees that behave consistently with other folder and resource nodes.
//
// The NodeSourceImpl base class provides the common implementation of the API
// at() and if() methods.  Derived classes implement the nodes() method to
// provide specific sets of nodes - for example a set containing a single
// resource folder node (which then has resource nodes under it by virtue
// of the inherent behaviour of a resource folder).

export abstract class NodeSourceImpl {
    at(parent: string | undefined): ExplorerExtender<ClusterExplorerNode> {
        return new ContributedNodeSourceExtender(parent, this);
    }
    if(condition: () => boolean | Thenable<boolean>): NodeSourceImpl {
        return new ConditionalNodeSource(this, condition);
    }
    abstract nodes(kubectl: Kubectl | undefined, host: Host | undefined): Promise<ClusterExplorerNode[]>;
}

export class CustomResourceFolderNodeSource extends NodeSourceImpl {
    constructor(private readonly resourceKind: kuberesources.ResourceKind) {
        super();
    }
    async nodes(_kubectl: Kubectl | undefined, _host: Host | undefined): Promise<ClusterExplorerNode[]> {
        return [ResourceFolderNode.create(this.resourceKind)];
    }
}

export class CustomGroupingFolderNodeSource extends NodeSourceImpl {
    constructor(private readonly displayName: string, private readonly contextValue: string | undefined, private readonly children: NodeSourceImpl[]) {
        super();
    }
    async nodes(_kubectl: Kubectl | undefined, _host: Host | undefined): Promise<ClusterExplorerNode[]> {
        return [new ContributedGroupingFolderNode(this.displayName, this.contextValue, this.children)];
    }
}

export interface ResourcesNodeSourceOptionsImpl {
    readonly lister?: () => Promise<{ name: string; customData?: any }[]>;
    readonly filter?: (o: ClusterExplorerResourceNode) => boolean;
    readonly childSources?: { readonly includeDefault: boolean; readonly sources: ReadonlyArray<(parent: ClusterExplorerResourceNode) => NodeSourceImpl> };
}

export class ResourcesNodeSource extends NodeSourceImpl {
    constructor(private readonly resourceKind: kuberesources.ResourceKind, private readonly options: ResourcesNodeSourceOptionsImpl | undefined) {
        super();
    }
    async nodes(kubectl: Kubectl | undefined, host: Host | undefined): Promise<ClusterExplorerNode[]> {
        if (!kubectl) {
            throw new Error("Internal error: explorer has no kubectl");
        }

        const childSources = this.options ? this.options.childSources : undefined;
        const crcs = childSources ? { includeDefaultChildSources: childSources.includeDefault, customSources: childSources.sources } : undefined;

        const lister = this.options ? this.options.lister : undefined;
        const listerObj: ResourceLister | undefined = lister ? {
            async list(_kubectl: Kubectl, kind: kuberesources.ResourceKind) {
                const infos = await lister();
                return infos.map((i) => ResourceNode.createForCustom(kind, i.name, i.customData, crcs));
            }
        } : undefined;

        const filter = this.options ? this.options.filter : undefined;

        const optionsImpl = {
            lister: listerObj,
            filter: filter,
            childSources: crcs,
        };

        return await ResourceNodeHelper.getResourceNodes(kubectl, host, this.resourceKind, optionsImpl);
    }
}

class ConditionalNodeSource extends NodeSourceImpl {
    constructor(private readonly impl: NodeSourceImpl, private readonly condition: () => boolean | Thenable<boolean>) {
        super();
    }
    async nodes(kubectl: Kubectl | undefined, host: Host | undefined): Promise<ClusterExplorerNode[]> {
        if (await this.condition()) {
            return this.impl.nodes(kubectl, host);
        }
        return [];
    }
}

export class ContributedNodeSourceExtender implements ExplorerExtender<ClusterExplorerNode> {
    constructor(private readonly under: string | undefined, private readonly nodeSource: NodeSourceImpl) { }
    contributesChildren(parent?: ClusterExplorerNode | undefined): boolean {
        if (!parent) {
            return false;
        }
        if (this.under) {
            return parent.nodeType === NODE_TYPES.folder.grouping && parent.displayName === this.under;
        }
        return parent.nodeType === NODE_TYPES.context && parent.kubectlContext.active;
    }
    getChildren(kubectl: Kubectl, host: Host, _parent?: ClusterExplorerNode | undefined): Promise<ClusterExplorerNode[]> {
        return this.nodeSource.nodes(kubectl, host);
    }
}
