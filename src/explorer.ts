import * as path from 'path';
import * as vscode from 'vscode';

import * as shell from './shell';
import { Kubectl } from './kubectl';
import * as kubectlUtils from './kubectlUtils';
import { Host } from './host';
import * as kuberesources from './kuberesources';
import { failed } from './errorable';

export function create(kubectl: Kubectl, host: Host): KubernetesExplorer {
    return new KubernetesExplorer(kubectl, host);
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

    constructor(private readonly kubectl: Kubectl, private readonly host: Host) {
        host.onDidChangeConfiguration((change) => {
            if (change.affectsConfiguration('vs-kubernetes')) {
                this.refresh();
            }
        });
    }

    getTreeItem(element: KubernetesObject): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element.getTreeItem();
    }

    getChildren(parent?: KubernetesObject): vscode.ProviderResult<KubernetesObject[]> {
        if (parent) {
            return parent.getChildren(this.kubectl, this.host);
        }
        return this.getClusters();
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
            new KubernetesServiceFolder(),
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
            new KubernetesDeploymentFolder(),
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
            new KubernetesDataHolderFolder(kuberesources.allKinds.configMap),
            new KubernetesDataHolderFolder(kuberesources.allKinds.secret)
        ];
    }
}

class KubernetesResourceFolder extends KubernetesFolder {
    constructor(readonly kind: kuberesources.ResourceKind) {
        super(kind.abbreviation, kind.pluralDisplayName, "vsKubernetes.kind");
    }

    async getChildren(kubectl: Kubectl, host: Host): Promise<KubernetesObject[]> {
        const childrenLines = await kubectl.asLines("get " + this.kind.abbreviation);
        if (failed(childrenLines)) {
            host.showErrorMessage(childrenLines.error[0]);
            return [new DummyObject("Error")];
        }
        return childrenLines.result.map((line) => {
            if (this.kind.abbreviation==="pod"){
            const bits = line.replace(/\s+/g,'|').split('|');
            return new KubernetesResource(this.kind, bits[0], {status: bits[2].toLowerCase()});
            }
            const bits = line.split(' ');
            return new KubernetesResource(this.kind, bits[0]);
        });
    }
}

class KubernetesResource implements KubernetesObject, ResourceNode {
    readonly resourceId: string;

    constructor(readonly kind: kuberesources.ResourceKind, readonly id: string, readonly metadata?: any) {
        this.resourceId = kind.abbreviation + '/' + id;
        this.metadata = metadata;
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
        if (this.kind === kuberesources.allKinds.pod ||
            this.kind == kuberesources.allKinds.secret ||
            this.kind == kuberesources.allKinds.configMap) {
			treeItem.contextValue = `vsKubernetes.resource.${this.kind.abbreviation}`;
            if (this.kind === kuberesources.allKinds.pod && this.metadata.status != null) {
				if (this.metadata.status === "running") {
					treeItem.iconPath = vscode.Uri.file(path.join(__dirname, "../../images/dark/runningPod.svg"));
				} else {
					treeItem.iconPath = vscode.Uri.file(path.join(__dirname, "../../images/dark/errorPod.svg"));
				}
			}
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

class KubernetesServiceFolder extends KubernetesResourceFolder {
    constructor() {
        super(kuberesources.allKinds.service);
    }

    async getChildren(kubectl: Kubectl, host: Host): Promise<KubernetesObject[]> {
        const services = await kubectlUtils.getServices(kubectl);
        return services.map((svc) => new KubernetesSelectorResource(this.kind, svc.name, svc, svc.selector));
    }
}

class KubernetesDeploymentFolder extends KubernetesResourceFolder {
    constructor() {
        super(kuberesources.allKinds.deployment);
    }

    async getChildren(kubectl: Kubectl, host: Host): Promise<KubernetesObject[]> {
        const deployments = await kubectlUtils.getDeployments(kubectl);
        return deployments.map((dp) => new KubernetesSelectorResource(this.kind, dp.name, dp, dp.selector));
    }
}

class KubernetesSelectorResource extends KubernetesResource {
    readonly selector?: any;
    constructor(readonly kind: kuberesources.ResourceKind, readonly id: string, readonly metadata?: any, readonly labelSelector?: any) {
        super(kind, id, metadata);
        this.selector = labelSelector;
    }

    async getTreeItem(): Promise<vscode.TreeItem> {
        const treeItem = await super.getTreeItem();
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        return treeItem;
    }

    async getChildren(kubectl: Kubectl, host: Host): Promise<KubernetesObject[]> {
        const pods = await kubectlUtils.getPods(kubectl, this.selector);
        return pods.map((p) => new KubernetesResource(kuberesources.allKinds.pod, p.name, p));
    }
}

class KubernetesDataHolderFolder extends KubernetesResourceFolder {
    constructor(kind: kuberesources.ResourceKind) {
        super(kind);
    }

    async getChildren(kubectl: Kubectl, host: Host): Promise<KubernetesObject[]> {
        const namespaces = await kubectlUtils.getDataHolders(this.kind.abbreviation, kubectl);
        return namespaces.map((cm) => new KubernetesDataHolderResource(this.kind, cm.metadata.name, cm, cm.data));
    }
}

export class KubernetesDataHolderResource extends KubernetesResource {
    readonly configData: any;
    readonly resource: string;

    constructor(readonly kind: kuberesources.ResourceKind, readonly id: string, readonly metadata?: any, readonly data?: any) {
        super(kind, id, metadata);
        this.configData = data;
        this.resource = this.kind.abbreviation;
    }

    async getTreeItem(): Promise<vscode.TreeItem> {
        const treeItem = await super.getTreeItem();
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        return treeItem;
    }

    async getChildren(kubectl: Kubectl, host: Host): Promise<KubernetesObject[]> {
        if (!this.configData || this.configData.length == 0) {
            return [];
        }
        let files = Object.keys(this.configData);
        return files.map((f) => new KubernetesFileObject(this.configData, f, this.resource, this.id));
    }
}

export class KubernetesFileObject implements KubernetesObject {
    constructor(readonly configData: any, readonly id: string, readonly resource: string, readonly parentName: string) {
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        let treeItem = new vscode.TreeItem(this.id, vscode.TreeItemCollapsibleState.None);
        treeItem.command = {
            command: "extension.vsKubernetesLoadConfigMapData",
            title: "Load",
            arguments: [this]
        };
        treeItem.contextValue = `vsKubernetes.file`;
        return treeItem;
    }

    getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<KubernetesObject[]> {
        return [];
    }
}
