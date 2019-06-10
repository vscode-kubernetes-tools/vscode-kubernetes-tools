import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { ClusterExplorerNode } from './node';
import { ResourceFolderNode } from './node.folder.resource';
import { ResourceNode } from './node.resource';

export class NodesFolder extends ResourceFolderNode {
    constructor() {
        super(kuberesources.allKinds.node);
    }
    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const nodes = await kubectlUtils.getGlobalResources(kubectl, 'nodes');
        return nodes.map((node) => ResourceNode.create(this.kind, node.metadata.name, node.metadata, undefined));
    }
}
