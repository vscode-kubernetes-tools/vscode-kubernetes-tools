import * as kuberesources from '../../kuberesources';
import { NodesFolder } from './node.folder.nodes';
import { NamespacesFolder } from './node.folder.namespaces';
import { SimpleResourceFolderNode, PodSelectingResourceFolderNode, ResourceFolderNode } from './node.folder.resource';

export function resourceFolderNodeCreate(kind: kuberesources.ResourceKind): ResourceFolderNode {
    switch (kind.manifestKind) {
        case 'Node': return new NodesFolder();
        case 'Namespace': return new NamespacesFolder();
        case 'Deployment':
        case 'StatefulSet':
        case 'Service':
        case 'DaemonSet':
            return new PodSelectingResourceFolderNode(kind);
        default:
            return new SimpleResourceFolderNode(kind);
    }
}
