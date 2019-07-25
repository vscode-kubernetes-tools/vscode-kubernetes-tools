import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { flatten } from '../../utils/array';
import { ClusterExplorerNode } from './node';
import { NodeSourceImpl } from './extension.nodesources';
import { GroupingFolderNode } from './node.folder.grouping';

export class ContributedGroupingFolderNode extends GroupingFolderNode {
    constructor(displayName: string, contextValue: string | undefined, private readonly children: NodeSourceImpl[]) {
        super('folder.grouping.custom', displayName, contextValue);
    }
    getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return this.getChildrenImpl(kubectl, host);
    }
    private async getChildrenImpl(kubectl: Kubectl, host: Host): Promise<ClusterExplorerNode[]> {
        const allNodesPromise = Promise.all(this.children.map((c) => c.nodes(kubectl, host)));
        const nodeArrays = await allNodesPromise;
        const nodes = flatten(...nodeArrays);
        return nodes;
    }
}
