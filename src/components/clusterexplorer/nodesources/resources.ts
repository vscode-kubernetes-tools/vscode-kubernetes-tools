import * as kuberesources from '../../../kuberesources';
import { ClusterExplorerNode } from '../node';
import { ResourceNodeHelper } from '../node.folder.resource';
import { Kubectl } from '../../../kubectl';
import { Host } from '../../../host';
import { NodeSource } from './nodesources';
import { GetResourceNodesOptions } from './resource-options';

export class ResourcesNodeSource extends NodeSource {
    constructor(private readonly resourceKind: kuberesources.ResourceKind, private readonly options: GetResourceNodesOptions) {
        super();
    }
    async nodes(kubectl: Kubectl | undefined, host: Host | undefined): Promise<ClusterExplorerNode[]> {
        if (!kubectl) {
            throw new Error("Internal error: explorer has no kubectl");
        }
        return await ResourceNodeHelper.getResourceNodes(kubectl, host, this.resourceKind, this.options);
    }
}
