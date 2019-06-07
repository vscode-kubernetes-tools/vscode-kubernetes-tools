import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { ClusterExplorerNode } from './node';
import { ResourceFolderNode } from './node.folder.resource';
import { NodeClusterExplorerNode } from './node.resource.node';

export class NodesFolder extends ResourceFolderNode {
    constructor() {
        super(kuberesources.allKinds.node);
    }
    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const nodes = await kubectlUtils.getGlobalResources(kubectl, 'nodes');
        return nodes.map((node) => new NodeClusterExplorerNode(node.metadata.name, node));
    }
}
