import * as vscode from 'vscode';

import { ResourceNode } from '../node.resource';
import { ResourceKind } from '../../../kuberesources';
import { Kubectl } from '../../../kubectl';
import * as kubectlUtils from '../../../kubectlUtils';
import { ClusterExplorerNode } from '../node';

export const namespaceUICustomiser = {
    customiseTreeItem(resource: ResourceNode, treeItem: vscode.TreeItem): void {
        const namespaceInfo = resource.extraInfo!.namespaceInfo!;  // TODO: unbang
        if (namespaceInfo.active) {
            treeItem.label = "* " + treeItem.label;
        }
        else {
            treeItem.contextValue += ".inactive";
        }
    }
};

export const namespaceLister = {
    async list(kubectl: Kubectl, kind: ResourceKind): Promise<ClusterExplorerNode[]> {
        const namespaces = await kubectlUtils.getNamespaces(kubectl);
        return namespaces.map((ns) => ResourceNode.create(kind, ns.name, ns.metadata, { namespaceInfo: ns }, undefined));
    }
};
