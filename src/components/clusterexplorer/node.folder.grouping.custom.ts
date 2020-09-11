import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import { flatten } from '../../utils/array';
import { ClusterExplorerNodev2 } from './node';
import { NodeSourceImpl } from './extension.nodesources';
import { GroupingFolderNode } from './node.folder.grouping';

export class ContributedGroupingFolderNode extends GroupingFolderNode {
    constructor(displayName: string, contextValue: string | undefined, private readonly children: NodeSourceImpl[]) {
        super('folder.grouping.custom', displayName, contextValue);
    }
    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNodev2[]> {
        return this.getChildrenImpl();
    }
    private async getChildrenImpl(): Promise<ClusterExplorerNodev2[]> {
        const allNodesPromise = Promise.all(this.children.map((c) => c.nodes()));
        const nodeArrays = await allNodesPromise;
        const nodes = flatten(...nodeArrays);
        return nodes;
    }
}
