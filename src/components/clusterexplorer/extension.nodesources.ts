import * as kuberesources from '../../kuberesources';
import { ExplorerExtender } from './explorer.extension';
import { ClusterExplorerNode, ClusterExplorerResourceNode } from './node';
import { ContributedGroupingFolderNode } from './node.folder.grouping.custom';
import { ResourceFolderNode } from './node.folder.resource';
import { NODE_TYPES } from './explorer';
import { MessageNode } from './node.message';
import { ResourceNode } from './node.resource';
import { failed } from '../../errorable';
import { getLister } from './resourceui';
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
    abstract nodes(kubectl: Kubectl, host: Host): Promise<ClusterExplorerNode[]>;
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

export interface ResourcesNodeSourceOptionsImpl {
    filter?: (o: ClusterExplorerResourceNode) => boolean;
}

export class ResourcesNodeSource extends NodeSourceImpl {
    constructor(private readonly resourceKind: kuberesources.ResourceKind, private readonly options: ResourcesNodeSourceOptionsImpl | undefined) {
        super();
    }
    async nodes(kubectl: Kubectl, host: Host): Promise<ClusterExplorerNode[]> {
        // TODO: deduplicate from ResourceFolderNode
        const lister = getLister(this.resourceKind);  // TODO: provide a way to override this
        if (lister) {
            return await lister.list(kubectl, this.resourceKind);
        }
        const childrenLines = await kubectl.asLines(`get ${this.resourceKind.abbreviation}`);
        if (failed(childrenLines)) {
            host.showErrorMessage(childrenLines.error[0]);
            return [new MessageNode("Error", childrenLines.error[0])];
        }
        const all = childrenLines.result.map((line) => {
            const bits = line.split(' ');
            return ResourceNode.create(this.resourceKind, bits[0], undefined, undefined);
        });
        const filter = (this.options && this.options.filter) ? this.options.filter : undefined;  // Yes we do need this because TS doesn't retain inferences about members across lambda boundaries (because JS 'this' is terrible)
        const filtered = filter ? all.filter((cern) => filter(cern)) : all;
        return filtered;
    }
}

class ConditionalNodeSource extends NodeSourceImpl {
    constructor(private readonly impl: NodeSourceImpl, private readonly condition: () => boolean | Thenable<boolean>) {
        super();
    }
    async nodes(kubectl: Kubectl, host: Host): Promise<ClusterExplorerNode[]> {
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
