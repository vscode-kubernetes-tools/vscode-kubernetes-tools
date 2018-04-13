import * as path from 'path';
import * as vscode from 'vscode';

import { KubernetesExplorerDataProviderRegistry } from './explorer.api';
import * as shell from './shell';
import { Kubectl } from './kubectl';
import * as kubectlUtils from './kubectlUtils';
import { Host } from './host';
import * as kuberesources from './kuberesources';

export function create(kubectl: Kubectl, host: Host, explorerRegistry: KubernetesExplorerDataProviderRegistry): KubernetesExplorer {
    return new KubernetesExplorer(kubectl, host, explorerRegistry);
}

export function createKubernetesResourceFolder(kind: kuberesources.ResourceKind): KubernetesObject {
    return new KubernetesResourceFolder(kind);
}

export function createKubernetesResource(kind: kuberesources.ResourceKind, id: string, metadata?: any): KubernetesObject {
    return new KubernetesResource(kind, id, metadata);
}

export interface KubernetesObject {
    readonly id: string;
    readonly metadata?: any;
    getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<KubernetesObject[]>;
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem>;
}

export interface ResourceNode {
    readonly id: string;
    readonly resourceId: string;
}

export class KubernetesExplorer implements vscode.TreeDataProvider<KubernetesObject> {
    private _onDidChangeTreeData: vscode.EventEmitter<KubernetesObject | undefined> = new vscode.EventEmitter<KubernetesObject | undefined>();
    readonly onDidChangeTreeData: vscode.Event<KubernetesObject | undefined> = this._onDidChangeTreeData.event;

    constructor(private readonly kubectl: Kubectl, private readonly host: Host, private readonly explorerRegistry: KubernetesExplorerDataProviderRegistry) { }

    getTreeItem(element: KubernetesObject): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element.getTreeItem();
    }

    async getChildren(parent?: KubernetesObject): Promise<KubernetesObject[]> {
        let children = [];
        if (parent) {
            children = await parent.getChildren(this.kubectl, this.host);
        } else {
            children = await this.getClusters();
        }
        // Load the tree nodes mounted by the third-party extensions.
        for (const provider of this.explorerRegistry.list()) {
            const mounted = await provider.getChildren(parent);
            if (mounted && mounted.length) {
                children = children.concat(mounted);
            }
        }
        return children;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    private async getClusters(): Promise<KubernetesObject[]> {
        const clusters = await kubectlUtils.getClusters(this.kubectl);
        return clusters.map((cluster) => new KubernetesCluster(cluster.name, cluster));
    }
}

/**
 * Dummy object will be displayed as a placeholder in the tree explorer. Cannot be expanded and has no action menus on it.
 * For example, display an "Error" dummy node when failing to get children of expandable parent.
 */
class DummyObject implements KubernetesObject {
    constructor(readonly id: string) {
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return new vscode.TreeItem(this.id, vscode.TreeItemCollapsibleState.None);
    }

    getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<KubernetesObject[]> {
        return [];
    }
}

class KubernetesCluster implements KubernetesObject {
    constructor(readonly id: string, readonly metadata?: any) {
    }

    getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<KubernetesObject[]> {
        return [
            new KubernetesNamespaceFolder(),
            new KubernetesResourceFolder(kuberesources.allKinds.node),
            new KubernetesWorkloadFolder(),
            new KubernetesResourceFolder(kuberesources.allKinds.service),
            new KubernetesResourceFolder(kuberesources.allKinds.ingress),
            new KubernetesConfigFolder()
        ];
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.id, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = "vsKubernetes.cluster";
        treeItem.iconPath = vscode.Uri.file(path.join(__dirname, "../../images/k8s-logo.png"));
        if (!this.metadata.active) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.contextValue += ".inactive";
        }
        return treeItem;
    }
}

abstract class KubernetesFolder implements KubernetesObject {
    constructor(readonly id: string, readonly displayName: string, readonly contextValue?: string) {
    }

    abstract getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<KubernetesObject[]>;

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.displayName, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = this.contextValue || `vsKubernetes.${this.id}`;
        return treeItem;
    }
}

class KubernetesWorkloadFolder extends KubernetesFolder {
    constructor() {
        super("workload", "Workloads");
    }

    getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<KubernetesObject[]> {
        return [
            new KubernetesResourceFolder(kuberesources.allKinds.deployment),
            new KubernetesResourceFolder(kuberesources.allKinds.job),
            new KubernetesResourceFolder(kuberesources.allKinds.pod)
        ];
    }
}

class KubernetesConfigFolder extends KubernetesFolder {
    constructor() {
        super("config", "Configuration");
    }

    getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<KubernetesObject[]> {
        return [
            new KubernetesResourceFolder(kuberesources.allKinds.configMap),
            new KubernetesResourceFolder(kuberesources.allKinds.secret)
        ];
    }
}

class KubernetesResourceFolder extends KubernetesFolder {
    constructor(readonly kind: kuberesources.ResourceKind) {
        super(kind.abbreviation, kind.pluralDisplayName, "vsKubernetes.kind");
    }

    async getChildren(kubectl: Kubectl, host: Host): Promise<KubernetesObject[]> {
        const childrenLines = await kubectl.asLines("get " + this.kind.abbreviation);
        if (shell.isShellResult(childrenLines)) {
            host.showErrorMessage(childrenLines.stderr);
            return [new DummyObject("Error")];
        }
        return childrenLines.map((line) => {
            const bits = line.split(' ');
            return new KubernetesResource(this.kind, bits[0]);
        });
    }
}

class KubernetesResource implements KubernetesObject, ResourceNode {
    readonly resourceId: string;

    constructor(readonly kind: kuberesources.ResourceKind, readonly id: string, readonly metadata?: any) {
        this.resourceId = kind.abbreviation + '/' + id;
    }

    getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<KubernetesObject[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        let treeItem = new vscode.TreeItem(this.id, vscode.TreeItemCollapsibleState.None);
        treeItem.command = {
            command: "extension.vsKubernetesLoad",
            title: "Load",
            arguments: [this]
        };
        treeItem.contextValue = `vsKubernetes.resource`;
        if (this.kind === kuberesources.allKinds.pod) {
            treeItem.contextValue = `vsKubernetes.resource.${this.kind.abbreviation}`;
        }
        return treeItem;
    }
}

class KubernetesNamespaceFolder extends KubernetesResourceFolder {
    constructor() {
        super(kuberesources.allKinds.namespace);
    }

    async getChildren(kubectl: Kubectl, host: Host): Promise<KubernetesObject[]> {
        const namespaces = await kubectlUtils.getNamespaces(kubectl);
        return namespaces.map((ns) => new KubernetesNamespaceResource(this.kind, ns.name, ns));
    }
}

class KubernetesNamespaceResource extends KubernetesResource {
    constructor(readonly kind: kuberesources.ResourceKind, readonly id: string, readonly metadata?: any) {
        super(kind, id, metadata);
    }

    async getTreeItem(): Promise<vscode.TreeItem> {
        const treeItem = await super.getTreeItem();
        treeItem.contextValue = `vsKubernetes.resource.${this.kind.abbreviation}`;
        if (this.metadata.active) {
            treeItem.label = "* " + treeItem.label;
        } else {
            treeItem.contextValue += ".inactive";
        }
        return treeItem;
    }
}
