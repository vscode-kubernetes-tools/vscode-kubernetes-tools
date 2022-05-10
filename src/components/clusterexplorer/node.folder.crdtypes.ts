import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { ClusterExplorerNode } from './node';
import { GroupingFolderNode } from './node.folder.grouping';
import { ResourceFolderNode } from './node.folder.resource';

export class CRDTypesFolderNode extends GroupingFolderNode {
    constructor() {
        super(kuberesources.allKinds.crd.abbreviation, kuberesources.allKinds.crd.pluralDisplayName);
    }
    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const objects = await kubectlUtils.getCRDTypes(kubectl);
        return objects.map(ResourceFolderNode.create);
    }
}
