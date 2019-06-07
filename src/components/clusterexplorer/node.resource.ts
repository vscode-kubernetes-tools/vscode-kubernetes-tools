import * as vscode from 'vscode';
import * as path from 'path';

import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { Pod } from '../../kuberesources.objectmodel';
import { kubefsUri } from '../../kuberesources.virtualfs';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerResourceNode } from './node';
import { ErrorNode } from './node.error';

export class ResourceNode extends ClusterExplorerNodeImpl implements ClusterExplorerResourceNode {
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
    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        if (this.kind !== kuberesources.allKinds.pod) {
            return [];
        }
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
                new ErrorNode(`${pod.status.phase} (${ready}/${pod.status.containerStatuses.length})`),
                new ErrorNode(pod.status.podIP),
            ];
        }
        else {
            return [new ErrorNode("Error", result.error[0])];
        }
    }
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.name, vscode.TreeItemCollapsibleState.None);
        treeItem.command = {
            command: "extension.vsKubernetesLoad",
            title: "Load",
            arguments: [this]
        };
        treeItem.contextValue = `vsKubernetes.resource.${this.kind.abbreviation}`;
        if (this.namespace) {
            treeItem.tooltip = `Namespace: ${this.namespace}`; // TODO: show only if in non-current namespace?
        }
        if (this.kind === kuberesources.allKinds.pod) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            if (this.metadata && this.metadata.status) {
                treeItem.iconPath = getIconForPodStatus(this.metadata.status.toLowerCase());
            }
        }
        return treeItem;
    }
}

export class PodSelectingResourceNode extends ResourceNode {
    readonly selector?: any;
    constructor(readonly kind: kuberesources.ResourceKind, readonly name: string, readonly metadata?: any, readonly labelSelector?: any) {
        super(kind, name, metadata);
        this.selector = labelSelector;
    }

    async getTreeItem(): Promise<vscode.TreeItem> {
        const treeItem = await super.getTreeItem();
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        return treeItem;
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        if (!this.selector) {
            return [];
        }
        const pods = await kubectlUtils.getPods(kubectl, this.selector);
        return pods.map((p) => new ResourceNode(kuberesources.allKinds.pod, p.name, p));
    }
}

function getIconForPodStatus(status: string): vscode.Uri {
    if (status === "running" || status === "completed") {
        return vscode.Uri.file(path.join(__dirname, "../../images/runningPod.svg"));
    } else {
        return vscode.Uri.file(path.join(__dirname, "../../images/errorPod.svg"));
    }
}
