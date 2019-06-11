import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { failed } from '../../errorable';
import { ClusterExplorerNode, ClusterExplorerResourceFolderNode } from './node';
import { MessageNode } from './node.message';
import { FolderNode } from './node.folder';
import { ResourceNode } from './node.resource';
import { getLister } from './resourceui';

export abstract class ResourceFolderNode extends FolderNode implements ClusterExplorerResourceFolderNode {
    constructor(readonly kind: kuberesources.ResourceKind) {
        super("folder.resource", kind.abbreviation, kind.pluralDisplayName, "vsKubernetes.kind");
    }
    readonly nodeType = 'folder.resource';
    async getChildren(kubectl: Kubectl, host: Host): Promise<ClusterExplorerNode[]> {
        const lister = getLister(this.kind);
        if (lister) {
            return await lister.list(kubectl, this.kind);
        }
        const childrenLines = await kubectl.asLines(`get ${this.kind.abbreviation}`);
        if (failed(childrenLines)) {
            host.showErrorMessage(childrenLines.error[0]);
            return [new MessageNode("Error")];
        }
        return childrenLines.result.map((line) => {
            const bits = line.split(' ');
            return ResourceNode.create(this.kind, bits[0], undefined, undefined);
        });
    }
}

export class SimpleResourceFolderNode extends ResourceFolderNode implements ClusterExplorerResourceFolderNode {
    constructor(readonly kind: kuberesources.ResourceKind) {
        super(kind);
    }
}
