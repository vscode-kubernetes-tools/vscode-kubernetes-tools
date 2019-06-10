import * as kubectlUtils from '../../kubectlUtils';
import * as kuberesources from '../../kuberesources';
import { ObjectMeta, DataResource } from '../../kuberesources.objectmodel';
import { ClusterExplorerResourceNode } from './node';
import { NodeClusterExplorerNode } from './node.resource.node';
import { NamespaceResourceNode } from './node.resource.namespace';
import { ConfigurationResourceNode } from './node.resource.configuration';
import { PodResourceNode, PodSelectingResourceNode, SimpleResourceNode } from './node.resource';

export function resourceNodeCreate(kind: kuberesources.ResourceKind, name: string, metadata: ObjectMeta | undefined, resource: kubectlUtils.PodInfo | kubectlUtils.NamespaceInfo | DataResource | kubectlUtils.HasSelector | undefined): ClusterExplorerResourceNode {
    if (kind.manifestKind === 'Pod') {
        return new PodResourceNode(name, metadata, resource as kubectlUtils.PodInfo);
    }
    if (kind.manifestKind === 'Node') {
        return new NodeClusterExplorerNode(name, metadata);
    }
    if (kind.manifestKind === 'Namespace') {
        return new NamespaceResourceNode(name, metadata, resource as kubectlUtils.NamespaceInfo);
    }
    if (kind.holdsConfigData) {
        return new ConfigurationResourceNode(kind, name, metadata, (resource as DataResource).data);
    }
    if (kind.selectsPods) {
        return new PodSelectingResourceNode(kind, name, metadata, (resource as kubectlUtils.HasSelector).selector);
    }
    return new SimpleResourceNode(kind, name, metadata);
}
