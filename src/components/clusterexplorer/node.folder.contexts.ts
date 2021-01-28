import * as vscode from 'vscode';
import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import * as kubectlUtils from '../../kubectlUtils';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerResourceFolderNode } from './node';
import { NODE_TYPES } from './explorer';
import * as providerResult from '../../utils/providerresult';
import { InactiveContextNode } from './node.context';
import { ResourceKind } from '../../kuberesources';
import { MessageNode } from './node.message';

export class AllContextsFolderNode extends ClusterExplorerNodeImpl implements ClusterExplorerResourceFolderNode {
    constructor() {
        super(NODE_TYPES.folder.resource);
    }
    kind: ResourceKind;
    readonly nodeType = NODE_TYPES.folder.resource;

    getChildren(kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        const contexts = kubectlUtils.getContexts(kubectl, { silent: false });  // TODO: turn it silent, cascade errors, and provide an error node
        return providerResult.map(contexts, (ti) => {
            if (!ti.active) {
                return new InactiveContextNode(ti.contextName, ti);
            }
            return new MessageNode(`* ${ti.contextName} (Active)`);
        });
    }

    getBaseTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return new vscode.TreeItem('Contexts', vscode.TreeItemCollapsibleState.Collapsed);
    }

    async apiURI(_kubectl: Kubectl, _namespace: string): Promise<string | undefined> {
        return undefined;
    }
}