import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { ClusterExplorerNode } from './node';
import { ResourceFolderNode } from './node.folder.resource';
import { NamespaceResourceNode } from './node.resource.namespace';

export class NamespacesFolder extends ResourceFolderNode {
    constructor() {
        super(kuberesources.allKinds.namespace);
    }
    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const namespaces = await kubectlUtils.getNamespaces(kubectl);
        return namespaces.map((ns) => new NamespaceResourceNode(this.kind, ns.name, ns.metadata, ns));
    }
}
