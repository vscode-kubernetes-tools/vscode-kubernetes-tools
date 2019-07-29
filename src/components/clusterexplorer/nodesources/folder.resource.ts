import * as kuberesources from '../../../kuberesources';
import { ClusterExplorerNode } from '../node';
import { ResourceFolderNode } from '../node.folder.resource';
import { Kubectl } from '../../../kubectl';
import { Host } from '../../../host';
import { NodeSource } from './nodesources';
import { ResourcesNodeSourceOptions, adaptOptions } from "./resource-options";

export class CustomResourceFolderNodeSource extends NodeSource {
    constructor(private readonly resourceKind: kuberesources.ResourceKind, private readonly options: ResourcesNodeSourceOptions | undefined) {
        super();
    }
    async nodes(_kubectl: Kubectl | undefined, _host: Host | undefined): Promise<ClusterExplorerNode[]> {
        const optionsImpl = adaptOptions(this.options);
        return [ResourceFolderNode.create(this.resourceKind, optionsImpl)];
    }
}
