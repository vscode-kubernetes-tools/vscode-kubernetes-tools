import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { ClusterExplorerNode, ClusterExplorerResourceFolderNode } from './node';
import { MessageNode } from './node.message';
import { FolderNode } from './node.folder';
import { ResourceNode } from './node.resource';
import { getLister } from './resourceui';
import { NODE_TYPES } from './explorer';
import { getResourceVersion } from '../../kubectlUtils';
import { ExecResult } from '../../binutilplusplus';
import { isSafeNamespace, isSafeResourceName, isSafeResourceType } from '../kubectl/resource-commands';

export class ResourceFolderNode extends FolderNode implements ClusterExplorerResourceFolderNode {

    static create(kind: kuberesources.ResourceKind): ResourceFolderNode {
        return new ResourceFolderNode(kind);
    }

    constructor(readonly kind: kuberesources.ResourceKind) {
        super(NODE_TYPES.folder.resource, kind.abbreviation, kind.pluralDisplayName, "vsKubernetes.kind");
    }
    readonly nodeType = NODE_TYPES.folder.resource;
    async getChildren(kubectl: Kubectl, host: Host): Promise<ClusterExplorerNode[]> {
        const lister = getLister(this.kind);
        if (lister) {
            return await lister.list(kubectl, this.kind);
        }
        if (!isSafeResourceType(this.kind.abbreviation)) {
            host.showErrorMessage('The Kubernetes endpoint returned an invalid resource type.');
            return [new MessageNode("Error")];
        }
        const children = await kubectl.invokeCommandArgs([
            'get', this.kind.abbreviation, '-o', 'jsonpath={range .items[*]}{"\\n"}{.metadata.name}{"\\t"}{.metadata.namespace}{end}'
        ]);
        if (ExecResult.failed(children)) {
            host.showErrorMessage(ExecResult.failureMessage(children, {}));
            return [new MessageNode("Error")];
        }
        const nodes: ClusterExplorerNode[] = [];
        for (const line of children.stdout.split(/\r?\n/).filter((value) => value.length > 0)) {
            const fields = line.split('\t');
            const name = fields[0];
            const namespace = fields[1];
            if (fields.length !== 2 || !isSafeResourceName(name) || (namespace.length > 0 && !isSafeNamespace(namespace))) {
                host.showErrorMessage('The Kubernetes endpoint returned invalid resource metadata.');
                return [new MessageNode("Error")];
            }
            nodes.push(ResourceNode.create(this.kind, name, { name, namespace }, undefined));
        }
        return nodes;
    }

    async apiURI(kubectl: Kubectl, namespace: string): Promise<string | undefined> {
        if (!this.kind.apiName) {
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
