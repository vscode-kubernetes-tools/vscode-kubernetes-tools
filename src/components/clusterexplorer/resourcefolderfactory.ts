import * as kuberesources from '../../kuberesources';
import { NodesFolder } from './node.folder.nodes';
import { NamespacesFolder } from './node.folder.namespaces';
import { SimpleResourceFolderNode, ResourceFolderNode } from './node.folder.resource';

export function resourceFolderNodeCreate(kind: kuberesources.ResourceKind): ResourceFolderNode {
    switch (kind.manifestKind) {
        case 'Node': return new NodesFolder();
        case 'Namespace': return new NamespacesFolder();
        default:
            return new SimpleResourceFolderNode(kind);
    }
}
