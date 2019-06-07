import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { failed } from '../../errorable';
import { ClusterExplorerNode, ClusterExplorerResourceFolderNode } from './node';
import { ErrorNode } from './node.error';
import { FolderNode } from './node.folder';
import { ResourceNode, PodSelectingResourceNode } from './node.resource';

export class ResourceFolderNode extends FolderNode implements ClusterExplorerResourceFolderNode {
    constructor(readonly kind: kuberesources.ResourceKind) {
        super("folder.resource", kind.abbreviation, kind.pluralDisplayName, "vsKubernetes.kind");
    }
    readonly nodeType = 'folder.resource';
    async getChildren(kubectl: Kubectl, host: Host): Promise<ClusterExplorerNode[]> {
        if (this.kind === kuberesources.allKinds.pod) {
            const pods = await kubectlUtils.getPods(kubectl, null, null);
            return pods.map((pod) => {
                return new ResourceNode(this.kind, pod.name, pod);
            });
        }
        const childrenLines = await kubectl.asLines(`get ${this.kind.abbreviation}`);
        if (failed(childrenLines)) {
            host.showErrorMessage(childrenLines.error[0]);
            return [new ErrorNode("Error")];
        }
        return childrenLines.result.map((line) => {
            const bits = line.split(' ');
            return new ResourceNode(this.kind, bits[0]);
        });
    }
}

export class PodSelectingResourceFolderNode extends ResourceFolderNode {
    constructor(readonly kind: kuberesources.ResourceKind) {
        super(kind);
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const objects = await kubectlUtils.getResourceWithSelector(this.kind.abbreviation, kubectl);
        return objects.map((obj) => new PodSelectingResourceNode(this.kind, obj.name, obj, obj.selector));
    }
}
