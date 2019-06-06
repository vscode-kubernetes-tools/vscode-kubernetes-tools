import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { ExplorerExtender } from './explorer.extension';
import { flatten } from '../../utils/array';
import { ClusterExplorerNode } from './node';
import { ContextNode } from './node.context';
import { FolderNode } from './node.folder';
import { ResourceFolderNode } from './node.folder.resource';

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
        return [new ResourceFolderNode(this.resourceKind)];
    }
}

export class CustomGroupingFolderNodeSource extends NodeSourceImpl {
    constructor(private readonly displayName: string, private readonly contextValue: string | undefined, private readonly children: NodeSourceImpl[]) {
        super();
    }
    async nodes(): Promise<ClusterExplorerNode[]> {
        return [new CustomGroupingFolder(this.displayName, this.contextValue, this.children)];
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
            return parent.nodeType === 'folder.grouping' && (parent as FolderNode).displayName === this.under;
        }
        return parent.nodeType === 'context' && (parent as ContextNode).metadata.active;
    }
    getChildren(_parent?: ClusterExplorerNode | undefined): Promise<ClusterExplorerNode[]> {
        return this.nodeSource.nodes();
    }
}

class CustomGroupingFolder extends FolderNode {
    constructor(displayName: string, contextValue: string | undefined, private readonly children: NodeSourceImpl[]) {
        super('folder.grouping', 'folder.grouping.custom', displayName, contextValue);
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return this.getChildrenImpl();
    }
    private async getChildrenImpl(): Promise<ClusterExplorerNode[]> {
        const allNodesPromise = Promise.all(this.children.map((c) => c.nodes()));
        const nodeArrays = await allNodesPromise;
        const nodes = flatten(...nodeArrays);
        return nodes;
    }
}
