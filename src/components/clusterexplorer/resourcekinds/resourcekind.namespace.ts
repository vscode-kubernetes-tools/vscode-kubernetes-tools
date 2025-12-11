import * as vscode from 'vscode';

import { ResourceNode } from '../node.resource';
import { ResourceKind } from '../../../kuberesources';
import { Kubectl } from '../../../kubectl';
import * as kubectlUtils from '../../../kubectlUtils';
import { ClusterExplorerNode } from '../node';
import { filterAccessibleNamespaces } from '../filter-accessible-namespaces';

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
        
        const config = vscode.workspace.getConfiguration('vs-kubernetes');
        const hideInaccessible = config['vs-kubernetes.hideInaccessibleNamespaces'] || false;
        
        if (!hideInaccessible) {
            // default behavior
            return namespaces.map((ns) => ResourceNode.create(kind, ns.name, ns.metadata, { namespaceInfo: ns }));
        }
        
        // filter to only accessible namespaces
        const namespaceNames = namespaces.map(ns => ns.name);
        const accessibleNames = await filterAccessibleNamespaces(kubectl, namespaceNames);
        const accessibleSet = new Set(accessibleNames);
        
        return namespaces
            .filter(ns => accessibleSet.has(ns.name))
            .map((ns) => ResourceNode.create(kind, ns.name, ns.metadata, { namespaceInfo: ns }));
    }
};
