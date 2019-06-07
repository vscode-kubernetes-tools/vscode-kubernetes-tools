import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { ClusterExplorerNode } from './node';
import { ResourceFolderNode } from './node.folder.resource';
import { ConfigurationResourceNode } from './node.resource.configuration';

export class ConfigurationResourceFolder extends ResourceFolderNode {
    constructor(kind: kuberesources.ResourceKind) {
        super(kind);
    }
    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const namespaces = await kubectlUtils.getDataHolders(this.kind.abbreviation, kubectl);
        return namespaces.map((cm) => new ConfigurationResourceNode(this.kind, cm.metadata.name, cm, cm.data));
    }
}
