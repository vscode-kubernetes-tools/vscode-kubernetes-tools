import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { Pod, ObjectMeta } from '../../kuberesources.objectmodel';
import { kubefsUri } from '../../kuberesources.virtualfs';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerResourceNode } from './node';
import { MessageNode } from './node.message';
import { resourceNodeCreate, getChildSources, getUICustomiser } from './resourcenodefactory';
import { ConfigurationValueNode } from './node.configurationvalue';

export abstract class ResourceNode extends ClusterExplorerNodeImpl implements ClusterExplorerResourceNode {
    readonly kindName: string;
    readonly nodeType = 'resource';
    constructor(readonly kind: kuberesources.ResourceKind, readonly name: string, readonly metadata: ObjectMeta | undefined, readonly extraInfo: ResourceExtraInfo | undefined) {
        super("resource");
        this.kindName = `${kind.abbreviation}/${name}`;
    }
    get namespace(): string | null {
        return (this.metadata && this.metadata.namespace) ? this.metadata.namespace : null;
    }
    uri(outputFormat: string): vscode.Uri {
        return kubefsUri(this.namespace, this.kindName, outputFormat);
    }
    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const childSources = getChildSources(this.kind);
        const children = Array.of<ClusterExplorerNode>();
        for (const source of childSources) {
            const sourcedChildren = await source.children(kubectl, this);
            children.push(...sourcedChildren);
        }
        return children;
    }
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const collapsibleState = this.isExpandable ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        const treeItem = new vscode.TreeItem(this.name, collapsibleState);
        treeItem.command = {
            command: "extension.vsKubernetesLoad",
            title: "Load",
            arguments: [this]
        };
        treeItem.contextValue = `vsKubernetes.resource.${this.kind.abbreviation}`;
        if (this.namespace) {
            treeItem.tooltip = `Namespace: ${this.namespace}`; // TODO: show only if in non-current namespace?
        }
        const uiCustomiser = getUICustomiser(this.kind);
        uiCustomiser.customiseTreeItem(this, treeItem);
        return treeItem;
    }
    get isExpandable(): boolean {
        return getChildSources(this.kind).length > 0;
    }
}

export interface ResourceExtraInfo {
    readonly configData?: any;
    readonly podInfo?: kubectlUtils.PodInfo;
    readonly labelSelector?: any;
    readonly namespaceInfo?: kubectlUtils.NamespaceInfo;
}

export const podStatusChildSource = {
    async children(kubectl: Kubectl, parent: ResourceNode): Promise<ClusterExplorerNode[]> {
        const nsarg = parent.namespace ? `--namespace=${parent.namespace}` : '';  // TODO: still not working!
        const result = await kubectl.asJson<Pod>(`get pods ${parent.name} ${nsarg} -o json`);
        if (result.succeeded) {
            const pod = result.result;
            let ready = 0;
            pod.status.containerStatuses.forEach((status) => {
                if (status.ready) {
                    ready++;
                }
            });
            return [
                new MessageNode(`${pod.status.phase} (${ready}/${pod.status.containerStatuses.length})`),
                new MessageNode(pod.status.podIP),
            ];
        }
        else {
            return [new MessageNode("Error", result.error[0])];
        }
    }
};

export const configItemsChildSource = {
    async children(_kubectl: Kubectl, parent: ResourceNode): Promise<ClusterExplorerNode[]> {
        const configData = parent.extraInfo!.configData;  // TODO: unbang
        if (!configData || configData.length === 0) {
            return [];
        }
        const files = Object.keys(configData);
        return files.map((f) => new ConfigurationValueNode(configData, f, parent.kind, parent.name));
    }
};

export const selectedPodsChildSource = {
    async children(kubectl: Kubectl, parent: ResourceNode): Promise<ClusterExplorerNode[]> {
        const labelSelector = parent.extraInfo!.labelSelector;  // TODO: unbang
        if (!labelSelector) {
            return [];
        }
        const pods = await kubectlUtils.getPods(kubectl, labelSelector);
        return pods.map((p) => resourceNodeCreate(kuberesources.allKinds.pod, p.name, p.metadata, { podInfo: p }));
    }
};

export const nodePodsChildSource = {
    async children(kubectl: Kubectl, parent: ResourceNode): Promise<ClusterExplorerNode[]> {
        const pods = await kubectlUtils.getPods(kubectl, null, 'all');
        const filteredPods = pods.filter((p) => `node/${p.nodeName}` === parent.kindName);
        return filteredPods.map((p) => resourceNodeCreate(kuberesources.allKinds.pod, p.name, p.metadata, { podInfo: p }));
    }
};

export class SimpleResourceNode extends ResourceNode {
    constructor(kind: kuberesources.ResourceKind, name: string, metadata: ObjectMeta | undefined, extraInfo: ResourceExtraInfo | undefined) {
        super(kind, name, metadata, extraInfo);
    }
}
