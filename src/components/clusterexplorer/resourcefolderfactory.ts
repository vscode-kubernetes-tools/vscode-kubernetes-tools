import * as kuberesources from '../../kuberesources';
import { NodesFolder } from './node.folder.nodes';
import { NamespacesFolder } from './node.folder.namespaces';
import { ConfigurationResourceFolder } from './node.folder.configurationresources';
import { PodResourceFolderNode, SimpleResourceFolderNode, PodSelectingResourceFolderNode, ResourceFolderNode } from './node.folder.resource';

export function resourceFolderNodeCreate(kind: kuberesources.ResourceKind): ResourceFolderNode {
    switch (kind.manifestKind) {
        case 'Node': return new NodesFolder();
        case 'Namespace': return new NamespacesFolder();
        case 'Pod': return new PodResourceFolderNode();
        case 'ConfigMap':
        case 'Secret':
            return new ConfigurationResourceFolder(kind);
        case 'Deployment':
        case 'StatefulSet':
        case 'Service':
        case 'DaemonSet':
            return new PodSelectingResourceFolderNode(kind);
        default:
            return new SimpleResourceFolderNode(kind);
    }
}
