import * as path from 'path';
import * as vscode from 'vscode';

import * as shell from './shell';
import { Kubectl } from './kubectl';
import * as kubectlUtils from './kubectlUtils';
import { Host } from './host';
import * as kuberesources from './kuberesources';

export function create(kubectl : Kubectl, host : Host) : KubernetesExplorer {
    return new KubernetesExplorer(kubectl, host);
}

export function createKindTreeNode(kind: kuberesources.ResourceKind) : KubernetesTreeNode {
    return new KubernetesKind(kind);
}

export function createResourceTreeNode(kind: kuberesources.ResourceKind, id: string, metadata?: any) : KubernetesTreeNode {
    return new KubernetesResource(kind, id, metadata);
}

export interface KubernetesObject {
    readonly id : string;
}

export interface ResourceNode {
    readonly id : string;
    readonly resourceId : string;
    readonly metadata?: any;
}

export class KubernetesExplorer implements vscode.TreeDataProvider<KubernetesObject> {
	private _onDidChangeTreeData: vscode.EventEmitter<KubernetesObject | undefined> = new vscode.EventEmitter<KubernetesObject | undefined>();
	readonly onDidChangeTreeData: vscode.Event<KubernetesObject | undefined> = this._onDidChangeTreeData.event;

    constructor(private readonly kubectl : Kubectl, private readonly host : Host) {}

    getTreeItem(element: KubernetesObject) : vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (element instanceof KubernetesTreeNode) {
            return element.getTreeItem();
        }
        return new vscode.TreeItem(element.id, vscode.TreeItemCollapsibleState.None);
    }

    getChildren(parent? : KubernetesObject) : vscode.ProviderResult<KubernetesObject[]> {
        if (parent) {
            return (parent instanceof KubernetesTreeNode) ? parent.getChildren(this.kubectl, this.host) : [];
        }
        return this.getClusters(this.kubectl);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    private async getClusters(kubectl: Kubectl) : Promise<KubernetesObject[]> {
        const clusters = await kubectlUtils.getClusters(kubectl);
        return clusters.map((c) => new VirtualKubernetesResource(c.name, 'cluster', c));
    }
}

abstract class KubernetesTreeNode implements KubernetesObject {
    constructor(readonly id: string) {
    }
    abstract getChildren(kubectl: Kubectl, host : Host) : vscode.ProviderResult<KubernetesObject[]>;
    abstract getTreeItem() : vscode.TreeItem | Thenable<vscode.TreeItem>;
}

class KubernetesKind extends KubernetesTreeNode {
    constructor(readonly kind: kuberesources.ResourceKind) {
        super(kind.abbreviation);
    }

    async getChildren(kubectl: Kubectl, host : Host) : Promise<KubernetesObject[]> {
        if (this.kind === kuberesources.allKinds.namespace) {
            const namespaces = await kubectlUtils.getNamespaces(kubectl);
            return namespaces.map((ns) => new KubernetesResource(this.kind, ns.name, ns));
        }
        const childrenLines = await kubectl.asLines("get " + this.kind.abbreviation);
        if (shell.isShellResult(childrenLines)) {
            host.showErrorMessage(childrenLines.stderr);
            return [ { id: "Error" } ];
        }
        return childrenLines.map((l) => this.parse(this.kind, l));
    }

    getTreeItem() : vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.kind.pluralDisplayName, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = `vsKubernetes.kind`;
        return treeItem;
    }

    private parse(kind : kuberesources.ResourceKind, kubeLine : string) : KubernetesObject {
        const bits = kubeLine.split(' ');
        return new KubernetesResource(kind, bits[0]);
    }
}

class KubernetesResource extends KubernetesTreeNode implements ResourceNode {
    readonly resourceId: string;
    constructor(readonly kind: kuberesources.ResourceKind, readonly id: string, readonly metadata?: any) {
        super(id);
        this.resourceId = kind.abbreviation + '/' + id;
    }

    getChildren(kubectl: Kubectl, host : Host) : vscode.ProviderResult<KubernetesObject[]> {
        return [];
    }

    getTreeItem() : vscode.TreeItem | Thenable<vscode.TreeItem> {
        let treeItem = new vscode.TreeItem(this.id, vscode.TreeItemCollapsibleState.None);
        treeItem.command = {
            command: "extension.vsKubernetesLoad",
            title: "Load",
            arguments: [ this ]
        };
        treeItem.contextValue = `vsKubernetes.resource`;
        if (this.kind === kuberesources.allKinds.namespace) {
            treeItem.contextValue = `vsKubernetes.resource.${this.kind.abbreviation}`;
            if (this.metadata.active) {
                treeItem.label = "*" + treeItem.label;
            } else {
                treeItem.contextValue += ".inactive";
            }
        } else if (this.kind === kuberesources.allKinds.pod) {
            treeItem.contextValue = `vsKubernetes.resource.${this.kind.abbreviation}`;
        }
        return treeItem;
    }
}

class VirtualKubernetesResource extends KubernetesTreeNode implements ResourceNode {
    readonly resourceId: string;

    constructor (readonly id: string, readonly kind: string, readonly metadata?: any) {
        super(id);
        this.resourceId = kind + "/" + id;
    }

    getChildren(kubectl: Kubectl, host : Host) : vscode.ProviderResult<KubernetesObject[]> {
        if (this.kind === 'cluster') {
            return [
                new KubernetesKind(kuberesources.allKinds.namespace),
                new KubernetesKind(kuberesources.allKinds.node),
                new VirtualKubernetesResource('Workloads', 'workload'),
                new KubernetesKind(kuberesources.allKinds.service)
            ];
        } else if (this.kind === 'workload') {
            return [
                new KubernetesKind(kuberesources.allKinds.deployment),
                new KubernetesKind(kuberesources.allKinds.job),
                new KubernetesKind(kuberesources.allKinds.pod)
            ];
        }
        return [];
    }

    getTreeItem() : vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.id, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = `vsKubernetes.resource.${this.kind}`;
        if (this.kind === 'cluster') {
            treeItem.iconPath = vscode.Uri.file(path.join(__dirname, "../../images/k8s-logo.png"));
            if (!this.metadata.active) {
                treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
                treeItem.contextValue += ".inactive";
            }
        }
        return treeItem;
    }
}
