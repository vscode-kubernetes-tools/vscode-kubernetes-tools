import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { ClusterExplorerNode } from './node';
import { ResourceFolderNode } from './node.folder.resource';
import { resourceNodeCreate } from './resourcenodefactory';

export class ConfigurationResourceFolder extends ResourceFolderNode {
    constructor(kind: kuberesources.ResourceKind) {
        super(kind);
    }
    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const resources = await kubectlUtils.getAsDataResources(this.kind.abbreviation, kubectl);
        return resources.map((r) => resourceNodeCreate(this.kind, r.metadata.name, r.metadata, { configData: r.data }));
    }
}
