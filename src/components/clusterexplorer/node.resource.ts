import * as vscode from 'vscode';
import * as path from 'path';

import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { Pod } from '../../kuberesources.objectmodel';
import { kubefsUri } from '../../kuberesources.virtualfs';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerResourceNode } from './node';
import { MessageNode } from './node.message';

export function createResourceNode(kind: kuberesources.ResourceKind, name: string, metadata?: any): ClusterExplorerResourceNode {
    if (kind.manifestKind === 'Pod') {
        return new PodResourceNode(name, metadata);
    }
    return new SimpleResourceNode(kind, name, metadata);
}

export abstract class ResourceNode extends ClusterExplorerNodeImpl implements ClusterExplorerResourceNode {
    readonly kindName: string;
    readonly nodeType = 'resource';
    constructor(readonly kind: kuberesources.ResourceKind, readonly name: string, readonly metadata?: any) {
        super("resource");
        this.kindName = `${kind.abbreviation}/${name}`;
    }
    get namespace(): string | null {
        return (this.metadata && this.metadata.namespace) ? this.metadata.namespace : null;
    }
    uri(outputFormat: string): vscode.Uri {
        return kubefsUri(this.namespace, this.kindName, outputFormat);
    }
    async getChildren(_kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        return [];
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
        return treeItem;
    }
    get isExpandable(): boolean {
        return false;
    }
    get iconPath(): string | undefined {
        return undefined;
    }
}

class SimpleResourceNode extends ResourceNode {
    constructor(readonly kind: kuberesources.ResourceKind, readonly name: string, readonly metadata?: any) {
        super(kind, name, metadata);
    }
}

class PodResourceNode extends ResourceNode {
    constructor(readonly name: string, readonly metadata?: any) {
        super(kuberesources.allKinds.pod, name, metadata);
    }
    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const result = await kubectl.asJson<Pod>(`get pods ${this.metadata.name} -o json`);
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
    async getTreeItem(): Promise<vscode.TreeItem> {
        const treeItem = await super.getTreeItem();
        if (this.metadata && this.metadata.status) {
            treeItem.iconPath = getIconForPodStatus(this.metadata.status.toLowerCase());
        }
        return treeItem;
    }
    get isExpandable() {
        return true;
    }
}

export class PodSelectingResourceNode extends ResourceNode {
    readonly selector?: any;
    constructor(readonly kind: kuberesources.ResourceKind, readonly name: string, readonly metadata?: any, readonly labelSelector?: any) {
        super(kind, name, metadata);
        this.selector = labelSelector;
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        if (!this.selector) {
            return [];
        }
        const pods = await kubectlUtils.getPods(kubectl, this.selector);
        return pods.map((p) => createResourceNode(kuberesources.allKinds.pod, p.name, p));
    }

    get isExpandable() {
        return true;
    }
}

function getIconForPodStatus(status: string): vscode.Uri {
    if (status === "running" || status === "completed") {
        return vscode.Uri.file(path.join(__dirname, "../../../../images/runningPod.svg"));
    } else {
        return vscode.Uri.file(path.join(__dirname, "../../../../images/errorPod.svg"));
    }
}
