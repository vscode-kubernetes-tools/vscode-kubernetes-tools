import * as vscode from 'vscode';

import { ClusterExplorerV1 } from "../../contract/cluster-explorer/v1";
import { ClusterExplorerNode, ClusterExplorerCustomNode } from "../../../components/clusterexplorer/node";
import { Kubectl } from "../../../kubectl";
import { Host } from "../../../host";
import { internalNodeOf } from './v1';

export class CustomNode implements ClusterExplorerCustomNode {
    readonly nodeCategory = 'kubernetes-explorer-node';
    readonly nodeType = 'extension';
    readonly id = 'dummy';
    constructor(private readonly impl: ClusterExplorerV1.Node) { }
    async getChildren(_kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        return (await this.impl.getChildren()).map((n) => internalNodeOf(n));
    }
    getTreeItem(): vscode.TreeItem {
        return this.impl.getTreeItem();
    }
}
