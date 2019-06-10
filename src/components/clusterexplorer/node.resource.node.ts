import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { ClusterExplorerNode } from './node';
import { ResourceNode } from './node.resource';
import { ObjectMeta } from '../../kuberesources.objectmodel';
import { resourceNodeCreate } from './resourcenodefactory';

export class NodeClusterExplorerNode extends ResourceNode {
    constructor(name: string, metadata: ObjectMeta | undefined) {
        super(kuberesources.allKinds.node, name, metadata);
    }
    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const pods = await kubectlUtils.getPods(kubectl, null, 'all');
        const filteredPods = pods.filter((p) => `node/${p.nodeName}` === this.kindName);
        return filteredPods.map((p) => resourceNodeCreate(kuberesources.allKinds.pod, p.name, p.metadata, p));
    }

    get isExpandable() {
        return true;
    }
}
