import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { failed } from '../../errorable';
import { ClusterExplorerNode } from './node';
import { ErrorNode } from './node.error';
import { FolderNode } from './node.folder';
import { ClusterExplorerResourceNode } from './node.resource';
import { ResourceFolder } from './explorer';

export class ResourceFolderNode extends FolderNode implements ResourceFolder {
    constructor(readonly kind: kuberesources.ResourceKind) {
        super("folder.resource", kind.abbreviation, kind.pluralDisplayName, "vsKubernetes.kind");
    }
    async getChildren(kubectl: Kubectl, host: Host): Promise<ClusterExplorerNode[]> {
        if (this.kind === kuberesources.allKinds.pod) {
            const pods = await kubectlUtils.getPods(kubectl, null, null);
            return pods.map((pod) => {
                return new ClusterExplorerResourceNode(this.kind, pod.name, pod);
            });
        }
        const childrenLines = await kubectl.asLines(`get ${this.kind.abbreviation}`);
        if (failed(childrenLines)) {
            host.showErrorMessage(childrenLines.error[0]);
            return [new ErrorNode("Error")];
        }
        return childrenLines.result.map((line) => {
            const bits = line.split(' ');
            return new ClusterExplorerResourceNode(this.kind, bits[0]);
        });
    }
}
