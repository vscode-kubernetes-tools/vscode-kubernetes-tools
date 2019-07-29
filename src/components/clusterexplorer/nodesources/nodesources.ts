import { ExplorerExtender } from '../explorer.extension';
import { ClusterExplorerNode } from '../node';
import { NODE_TYPES } from '../explorer';
import { Kubectl } from '../../../kubectl';
import { Host } from '../../../host';
import { ConditionalNodeSource } from './conditional';

// This directory contains 'node sources' - built-in ways of creating nodes of
// *built-in* types (as opposed to the completely custom nodes created by an
// ExplorerExtender).  Node sources can be consumed and composed through the API
// to build trees that behave consistently with other folder and resource nodes.
//
// The NodeSource base class provides the common implementation of the API
// at() and if() methods.  Derived classes implement the nodes() method to
// provide specific sets of nodes - for example a set containing a single
// resource folder node (which then has resource nodes under it by virtue
// of the inherent behaviour of a resource folder).

export abstract class NodeSource {
    at(parent: string | undefined): ExplorerExtender<ClusterExplorerNode> {
        return new ContributedNodeSourceExtender(parent, this);
    }
    if(condition: () => boolean | Thenable<boolean>): NodeSource {
        return new ConditionalNodeSource(this, condition);
    }
    abstract nodes(kubectl: Kubectl | undefined, host: Host | undefined): Promise<ClusterExplorerNode[]>;
}

// Joins a NodeSource up to the tree via the usual ExplorerExtender plumbing
export class ContributedNodeSourceExtender implements ExplorerExtender<ClusterExplorerNode> {
    constructor(private readonly under: string | undefined, private readonly nodeSource: NodeSource) { }
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
