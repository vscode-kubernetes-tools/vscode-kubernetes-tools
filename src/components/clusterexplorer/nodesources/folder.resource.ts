import * as kuberesources from '../../../kuberesources';
import { ClusterExplorerNode } from '../node';
import { ResourceFolderNode } from '../node.folder.resource';
import { Kubectl } from '../../../kubectl';
import { Host } from '../../../host';
import { NodeSource } from './nodesources';
import { GetResourceNodesOptions } from './resource-options';

export class CustomResourceFolderNodeSource extends NodeSource {
    constructor(private readonly resourceKind: kuberesources.ResourceKind, private readonly options: GetResourceNodesOptions) {
        super();
    }
    async nodes(_kubectl: Kubectl | undefined, _host: Host | undefined): Promise<ClusterExplorerNode[]> {
        return [ResourceFolderNode.create(this.resourceKind, this.options)];
    }
}
