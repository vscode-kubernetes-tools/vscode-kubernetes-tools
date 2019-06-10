import * as vscode from 'vscode';

import * as kuberesources from '../../kuberesources';
import { ResourceNode } from './node.resource';
import { ObjectMeta } from '../../kuberesources.objectmodel';
import { NamespaceInfo } from '../../kubectlUtils';

export class NamespaceResourceNode extends ResourceNode {
    constructor(name: string, metadata: ObjectMeta | undefined, private readonly nsinfo: NamespaceInfo) {
        super(kuberesources.allKinds.namespace, name, metadata, undefined);
    }
    async getTreeItem(): Promise<vscode.TreeItem> {
        const treeItem = await super.getTreeItem();
        treeItem.contextValue = `vsKubernetes.resource.${this.kind.abbreviation}`;
        if (this.nsinfo.active) {
            treeItem.label = "* " + treeItem.label;
        }
        else {
            treeItem.contextValue += ".inactive";
        }
        return treeItem;
    }
}
