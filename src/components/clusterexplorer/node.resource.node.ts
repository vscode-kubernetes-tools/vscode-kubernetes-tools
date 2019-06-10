import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { ClusterExplorerNode } from './node';
import { ResourceNode, PodResourceNode } from './node.resource';

export class NodeClusterExplorerNode extends ResourceNode {
    constructor(name: string, meta: any) {
        super(kuberesources.allKinds.node, name, meta);
    }
    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const pods = await kubectlUtils.getPods(kubectl, null, 'all');
        const filteredPods = pods.filter((p) => `node/${p.nodeName}` === this.kindName);
        return filteredPods.map((p) => new PodResourceNode(p.name, p.metadata, p));
    }

    get isExpandable() {
        return true;
    }
}
