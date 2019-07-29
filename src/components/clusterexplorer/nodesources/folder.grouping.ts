import * as vscode from 'vscode';

import { flatten } from '../../../utils/array';
import { ClusterExplorerNode } from '../node';
import { NodeSource } from './nodesources';
import { GroupingFolderNode } from '../node.folder.grouping';
import { Kubectl } from '../../../kubectl';
import { Host } from '../../../host';

export class CustomGroupingFolderNodeSource extends NodeSource {
    constructor(private readonly displayName: string, private readonly contextValue: string | undefined, private readonly children: NodeSource[]) {
        super();
    }
    async nodes(_kubectl: Kubectl | undefined, _host: Host | undefined): Promise<ClusterExplorerNode[]> {
        return [new ContributedGroupingFolderNode(this.displayName, this.contextValue, this.children)];
    }
}

class ContributedGroupingFolderNode extends GroupingFolderNode {
    constructor(displayName: string, contextValue: string | undefined, private readonly children: NodeSource[]) {
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
