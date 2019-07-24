import * as kuberesources from '../../kuberesources';
import { ExplorerExtender } from './explorer.extension';
import { ClusterExplorerNode } from './node';
import { ContributedGroupingFolderNode } from './node.folder.grouping.custom';
import { ResourceFolderNode } from './node.folder.resource';
import { NODE_TYPES } from './explorer';

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
    abstract nodes(): Promise<ClusterExplorerNode[]>;
}

export class CustomResourceFolderNodeSource extends NodeSourceImpl {
    constructor(private readonly resourceKind: kuberesources.ResourceKind) {
        super();
    }
    async nodes(): Promise<ClusterExplorerNode[]> {
        return [ResourceFolderNode.create(this.resourceKind)];
    }
}

export class CustomGroupingFolderNodeSource extends NodeSourceImpl {
    constructor(private readonly displayName: string, private readonly contextValue: string | undefined, private readonly children: NodeSourceImpl[]) {
        super();
    }
    async nodes(): Promise<ClusterExplorerNode[]> {
        return [new ContributedGroupingFolderNode(this.displayName, this.contextValue, this.children)];
    }
}

class ConditionalNodeSource extends NodeSourceImpl {
    constructor(private readonly impl: NodeSourceImpl, private readonly condition: () => boolean | Thenable<boolean>) {
        super();
    }
    async nodes(): Promise<ClusterExplorerNode[]> {
        if (await this.condition()) {
            return this.impl.nodes();
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
    getChildren(_parent?: ClusterExplorerNode | undefined): Promise<ClusterExplorerNode[]> {
        return this.nodeSource.nodes();
    }
}
