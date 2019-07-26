import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { failed } from '../../errorable';
import { ClusterExplorerNode, ClusterExplorerResourceFolderNode, ClusterExplorerResourceNode } from './node';
import { MessageNode } from './node.message';
import { FolderNode } from './node.folder';
import { ResourceNode } from './node.resource';
import { getLister, ResourceLister, CustomResourceChildSources } from './resourceui';
import { NODE_TYPES } from './explorer';

export class ResourceFolderNode extends FolderNode implements ClusterExplorerResourceFolderNode {

    static create(kind: kuberesources.ResourceKind, options?: GetResourceNodesOptions): ResourceFolderNode {
        return new ResourceFolderNode(kind, options || {});
    }

    constructor(readonly kind: kuberesources.ResourceKind, private readonly options: GetResourceNodesOptions) {
        super(NODE_TYPES.folder.resource, kind.abbreviation, kind.pluralDisplayName, "vsKubernetes.kind");
    }
    readonly nodeType = NODE_TYPES.folder.resource;
    async getChildren(kubectl: Kubectl, host: Host): Promise<ClusterExplorerNode[]> {
        return await ResourceNodeHelper.getResourceNodes(kubectl, host, this.kind, this.options);
    }
}

export interface GetResourceNodesOptions {
    readonly lister?: ResourceLister;
    readonly filter?: (o: ClusterExplorerResourceNode) => boolean;
    readonly childSources?: CustomResourceChildSources;
}

export class ResourceNodeHelper {
    static async getResourceNodes(
            kubectl: Kubectl,
            host: Host | undefined,
            resourceKind: kuberesources.ResourceKind,
            options: GetResourceNodesOptions
    ): Promise<ClusterExplorerNode[]> {

        const effectiveLister = options.lister || getLister(resourceKind);
        if (effectiveLister) {
            return await effectiveLister.list(kubectl, resourceKind);
        }

        const childrenLines = await kubectl.asLines(`get ${resourceKind.abbreviation}`);
        if (failed(childrenLines)) {
            if (host) {  // There always should be.  But we can't prove this to the compiler, and it's not worth failing if there isn't.
                host.showErrorMessage(childrenLines.error[0]);
            }
            return [new MessageNode("Error", childrenLines.error[0])];
        }
        const all = childrenLines.result.map((line) => {
            const bits = line.split(' ');
            return ResourceNode.createForCustom(resourceKind, bits[0], undefined, options.childSources);
        });

        const filter = options.filter;
        const filtered = filter ? all.filter((cern) => filter(cern)) : all;
        return filtered;
    }
}
