import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { failed } from '../../errorable';
import { ClusterExplorerNode, ClusterExplorerResourceFolderNode } from './node';
import { MessageNode } from './node.message';
import { FolderNode } from './node.folder';
import { ResourceNode } from './node.resource';
import { getLister } from './resourceui';
import { NODE_TYPES } from './explorer';
import { getResourceVersion } from '../../kubectlUtils';
import {
    INVALID_KUBERNETES_IDENTIFIER_MESSAGE,
    isSafeOpaqueIdentifier,
    isValidKubernetesResourceType,
    isValidNamespaceName,
} from '../../utils/kubernetes-identifiers';

export class ResourceFolderNode extends FolderNode implements ClusterExplorerResourceFolderNode {

    static create(kind: kuberesources.ResourceKind): ResourceFolderNode {
        return new ResourceFolderNode(kind);
    }

    constructor(readonly kind: kuberesources.ResourceKind) {
        super(NODE_TYPES.folder.resource, kind.abbreviation, kind.pluralDisplayName, "vsKubernetes.kind");
    }
    readonly nodeType = NODE_TYPES.folder.resource;
    async getChildren(kubectl: Kubectl, host: Host): Promise<ClusterExplorerNode[]> {
        if (!isValidKubernetesResourceType(this.kind.abbreviation)) {
            host.showErrorMessage(INVALID_KUBERNETES_IDENTIFIER_MESSAGE);
            return [new MessageNode("Error")];
        }
        const lister = getLister(this.kind);
        if (lister) {
            return await lister.list(kubectl, this.kind);
        }
        const childrenLines = await kubectl.asLines([
            'get',
            this.kind.abbreviation,
            '-o',
            'custom-columns=NAME:.metadata.name,NAMESPACE:.metadata.namespace'
        ]);
        if (failed(childrenLines)) {
            host.showErrorMessage(childrenLines.error[0]);
            return [new MessageNode("Error")];
        }
        const resources = childrenLines.result.map((line) => {
            const bits = line.replace(/\r$/, '').split(/\s+/);
            const namespace = bits[1] === '<none>' ? '' : bits[1];
            if (bits.length !== 2 ||
                !isSafeOpaqueIdentifier(bits[0]) ||
                (namespace !== '' && !isValidNamespaceName(namespace))) {
                return undefined;
            }
            const metadata = {
                name: bits[0],
                namespace
            };
            return ResourceNode.create(this.kind, bits[0], metadata, undefined);
        });
        if (resources.some((resource) => resource === undefined)) {
            host.showErrorMessage(INVALID_KUBERNETES_IDENTIFIER_MESSAGE);
            return [new MessageNode("Error")];
        }
        return resources as ClusterExplorerNode[];
    }

    async apiURI(kubectl: Kubectl, namespace: string): Promise<string | undefined> {
        if (!this.kind.apiName ||
            !isValidKubernetesResourceType(this.kind.apiName) ||
            (namespace !== '' && !isValidNamespaceName(namespace))) {
            return undefined;
        }
        const resources = this.kind.apiName.replace(/\s/g, '').toLowerCase();
        const version = await getResourceVersion(kubectl, resources);
        if (!version) {
            return undefined;
        }
        const baseUri = (version === 'v1') ? `/api/${version}/` : `/apis/${version}/`;
        const namespaceUri = this.namespaceUriPart(namespace, resources);
        return `${baseUri}${namespaceUri}${resources}`;
    }

    private namespaceUriPart(ns: string, resources: string): string {
        let namespaceUri = `namespaces/${ns}/`;
        switch (resources) {
            case "namespaces":
            case "nodes":
            case "persistentvolumes":
            case "storageclasses":
                namespaceUri = '';
                break;
            default:
                break;
        }
        return namespaceUri;
    }
}
