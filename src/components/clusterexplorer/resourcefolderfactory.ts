import * as kuberesources from '../../kuberesources';
import { SimpleResourceFolderNode, ResourceFolderNode } from './node.folder.resource';

export function resourceFolderNodeCreate(kind: kuberesources.ResourceKind): ResourceFolderNode {
    return new SimpleResourceFolderNode(kind);
}
