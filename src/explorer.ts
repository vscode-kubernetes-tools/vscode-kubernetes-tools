import * as path from 'path';
import * as vscode from 'vscode';

import { Kubectl } from './kubectl';
import * as kubectlUtils from './kubectlUtils';
import { Host } from './host';
import * as kuberesources from './kuberesources';
import { failed } from './errorable';
import * as helmexec from './helm.exec';
import { Pod, CRD } from './kuberesources.objectmodel';
import { kubefsUri } from './kuberesources.virtualfs';
import { affectsUs } from './components/config/config';

const KUBERNETES_CLUSTER = "vsKubernetes.cluster";
const MINIKUBE_CLUSTER = "vsKubernetes.minikubeCluster";

export function create(kubectl: Kubectl, host: Host): KubernetesExplorer {
    return new KubernetesExplorer(kubectl, host);
}

export function createKubernetesResourceFolder(kind: kuberesources.ResourceKind): KubernetesObject {
    return new KubernetesResourceFolder(kind);
}

export function createKubernetesResource(kind: kuberesources.ResourceKind, id: string, metadata?: any): KubernetesObject {
    return new KubernetesResource(kind, id, metadata);
}

function getIconForHelmRelease(status: string): vscode.Uri {
    if (status === "deployed") {
        return vscode.Uri.file(path.join(__dirname, "../../images/helmDeployed.svg"));
    } else {
        return vscode.Uri.file(path.join(__dirname, "../../images/helmFailed.svg"));
    }
}

function getIconForPodStatus(status: string): vscode.Uri {
    if (status === "running" || status === "completed") {
        return vscode.Uri.file(path.join(__dirname, "../../images/runningPod.svg"));
    } else {
        return vscode.Uri.file(path.join(__dirname, "../../images/errorPod.svg"));
    }
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
    uri(outputFormat: string): vscode.Uri;
    namespace: string | null;
}

export function isKubernetesExplorerResourceNode(obj: any): obj is ResourceNode {
    return obj && obj.id && obj.resourceId;
}

export class KubernetesExplorer implements vscode.TreeDataProvider<KubernetesObject> {
    private onDidChangeTreeDataEmitter: vscode.EventEmitter<KubernetesObject | undefined> = new vscode.EventEmitter<KubernetesObject | undefined>();
    readonly onDidChangeTreeData: vscode.Event<KubernetesObject | undefined> = this.onDidChangeTreeDataEmitter.event;

    constructor(private readonly kubectl: Kubectl, private readonly host: Host) {
        host.onDidChangeConfiguration((change) => {
            if (affectsUs(change)) {
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
        this.onDidChangeTreeDataEmitter.fire();
    }

    private async getClusters(): Promise<KubernetesObject[]> {
        const contexts = await kubectlUtils.getContexts(this.kubectl);
        return contexts.map((context): KubernetesContextNode => {
            // TODO: this is slightly hacky...
            if (context.contextName === 'minikube') {
                return new MiniKubeContextNode(context.contextName, context);
            }

            return new KubernetesContextNode(context.contextName, context);
        });
    }
}

/**
 * Dummy object will be displayed as a placeholder in the tree explorer. Cannot be expanded and has no action menus on it.
 * For example, display an "Error" dummy node when failing to get children of expandable parent.
 */
class DummyObject implements KubernetesObject {
    constructor(readonly id: string, readonly diagnostic?: string) {
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.id, vscode.TreeItemCollapsibleState.None);
        if (this.diagnostic) {
            treeItem.tooltip = this.diagnostic;
        }
        return treeItem;
    }

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<KubernetesObject[]> {
        return [];
    }
}

class KubernetesContextNode implements KubernetesObject {

    constructor(readonly id: string, readonly metadata?: kubectlUtils.KubectlContext) {
    }

    get icon(): vscode.Uri {
        return vscode.Uri.file(path.join(__dirname, "../../images/k8s-logo.png"));
    }

    get clusterType(): string {
        return KUBERNETES_CLUSTER;
    }

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<KubernetesObject[]> {
        return [
            new KubernetesNamespaceFolder(),
            new KubernetesNodeFolder(),
            new KubernetesWorkloadFolder(),
            new KubernetesNetworkFolder(),
            new KubernetesStorageFolder(),
            new KubernetesConfigFolder(),
            new KubernetesCRDFolder(),
            new HelmReleasesFolder(),
        ];
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.id, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = this.clusterType;
        treeItem.iconPath = this.icon;

        if (!this.metadata || !this.metadata.active) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.contextValue += ".inactive";
        }

        if (this.metadata) {
            treeItem.tooltip = `${this.metadata.contextName}\nCluster: ${this.metadata.clusterName}`;
        }

        return treeItem;
    }
}

class MiniKubeContextNode extends KubernetesContextNode {
    get icon(): vscode.Uri {
        return vscode.Uri.file(path.join(__dirname, "../../images/minikube-logo.png"));
    }

    get clusterType(): string {
        return MINIKUBE_CLUSTER;
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

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<KubernetesObject[]> {
        return [
            new KubernetesSelectsPodsFolder(kuberesources.allKinds.deployment),
            new KubernetesSelectsPodsFolder(kuberesources.allKinds.statefulSet),
            new KubernetesSelectsPodsFolder(kuberesources.allKinds.daemonSet),
            new KubernetesResourceFolder(kuberesources.allKinds.job),
            new KubernetesResourceFolder(kuberesources.allKinds.cronjob),
            new KubernetesResourceFolder(kuberesources.allKinds.pod),
        ];
    }
}

class KubernetesConfigFolder extends KubernetesFolder {
    constructor() {
        super("config", "Configuration");
    }

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<KubernetesObject[]> {
        return [
            new KubernetesDataHolderFolder(kuberesources.allKinds.configMap),
            new KubernetesDataHolderFolder(kuberesources.allKinds.secret)
        ];
    }
}

class KubernetesNetworkFolder extends KubernetesFolder {
    constructor() {
        super("network", "Network");
    }

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<KubernetesObject[]> {
        return [
            new KubernetesSelectsPodsFolder(kuberesources.allKinds.service),
            new KubernetesResourceFolder(kuberesources.allKinds.endpoint),
            new KubernetesResourceFolder(kuberesources.allKinds.ingress),
        ];
    }
}

class KubernetesStorageFolder extends KubernetesFolder {
    constructor() {
        super("storage", "Storage");
    }

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<KubernetesObject[]> {
        return [
            new KubernetesResourceFolder(kuberesources.allKinds.persistentVolume),
            new KubernetesResourceFolder(kuberesources.allKinds.persistentVolumeClaim),
            new KubernetesResourceFolder(kuberesources.allKinds.storageClass),
        ];
    }
}

class KubernetesResourceFolder extends KubernetesFolder {
    constructor(readonly kind: kuberesources.ResourceKind) {
        super(kind.abbreviation, kind.pluralDisplayName, "vsKubernetes.kind");
    }

    async getChildren(kubectl: Kubectl, host: Host): Promise<KubernetesObject[]> {
        if (this.kind === kuberesources.allKinds.pod) {
            const pods = await kubectlUtils.getPods(kubectl, null, null);
            return pods.map((pod) => {
                return new KubernetesResource(this.kind, pod.name, pod);
            });
        }
        const childrenLines = await kubectl.asLines(`get ${this.kind.abbreviation}`);
        if (failed(childrenLines)) {
            host.showErrorMessage(childrenLines.error[0]);
            return [new DummyObject("Error")];
        }
        return childrenLines.result.map((line) => {
            const bits = line.split(' ');
            return new KubernetesResource(this.kind, bits[0]);
        });
    }
}

class KubernetesResource implements KubernetesObject, ResourceNode {
    readonly resourceId: string;

    constructor(readonly kind: kuberesources.ResourceKind, readonly id: string, readonly metadata?: any) {
        this.resourceId = `${kind.abbreviation}/${id}`;
    }

    get namespace(): string | null {
        return (this.metadata && this.metadata.namespace) ? this.metadata.namespace : null;
    }

    uri(outputFormat: string): vscode.Uri {
        return kubefsUri(this.namespace, this.resourceId, outputFormat);
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<KubernetesObject[]> {
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
                new DummyObject(`${pod.status.phase} (${ready}/${pod.status.containerStatuses.length})`),
                new DummyObject(pod.status.podIP),
            ];
        } else {
            return [ new DummyObject("Error", result.error[0]) ];
        }
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.id, vscode.TreeItemCollapsibleState.None);
        treeItem.command = {
            command: "extension.vsKubernetesLoad",
            title: "Load",
            arguments: [this]
        };
        treeItem.contextValue = `vsKubernetes.resource.${this.kind.abbreviation}`;

        if (this.namespace) {
            treeItem.tooltip = `Namespace: ${this.namespace}`;  // TODO: show only if in non-current namespace?
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

class KubernetesNodeFolder extends KubernetesResourceFolder {
    constructor() {
        super(kuberesources.allKinds.node);
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<KubernetesObject[]> {
        const nodes = await kubectlUtils.getGlobalResources(kubectl, 'nodes');
        return nodes.map((node) => new KubernetesNodeResource(node.metadata.name, node));
    }
}

class KubernetesNodeResource extends KubernetesResource {
    constructor(name: string, meta: any) {
        super(kuberesources.allKinds.node, name, meta);
    }

    async getTreeItem(): Promise<vscode.TreeItem> {
        const treeItem = await super.getTreeItem();
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        return treeItem;
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<KubernetesObject[]> {
        const pods = await kubectlUtils.getPods(kubectl, null, 'all');
        const filteredPods = pods.filter((p) => `node/${p.nodeName}` === this.resourceId);
        return filteredPods.map((p) => new KubernetesResource(kuberesources.allKinds.pod, p.name, p));
    }
}

class KubernetesNamespaceFolder extends KubernetesResourceFolder {
    constructor() {
        super(kuberesources.allKinds.namespace);
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<KubernetesObject[]> {
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

class KubernetesSelectsPodsFolder extends KubernetesResourceFolder {
    constructor(readonly kind: kuberesources.ResourceKind) {
        super(kind);
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<KubernetesObject[]> {
        const objects = await kubectlUtils.getResourceWithSelector(this.kind.abbreviation, kubectl);
        return objects.map((obj) => new KubernetesSelectorResource(this.kind, obj.name, obj, obj.selector));
    }
}

class KubernetesCRDFolder extends KubernetesFolder {
    constructor() {
        super(kuberesources.allKinds.crd.abbreviation, kuberesources.allKinds.crd.pluralDisplayName);
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<KubernetesObject[]> {
        const objects = await kubectlUtils.getCRDTypes(kubectl);
        return objects.map((obj) => new KubernetesResourceFolder(this.customResourceKind(obj)));
    }

    private customResourceKind(crd: CRD): kuberesources.ResourceKind {
        return new kuberesources.ResourceKind(
            crd.spec.names.singular,
            crd.spec.names.plural,
            crd.spec.names.kind,
            this.safeAbbreviation(crd)
        );
    }

    private safeAbbreviation(crd: CRD): string {
        const shortNames = crd.spec.names.shortNames;
        return (shortNames && shortNames.length > 0) ? shortNames[0] : crd.metadata.name;
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

    async getChildren(kubectl: Kubectl, _host: Host): Promise<KubernetesObject[]> {
        if (!this.selector) {
            return [];
        }
        const pods = await kubectlUtils.getPods(kubectl, this.selector);
        return pods.map((p) => new KubernetesResource(kuberesources.allKinds.pod, p.name, p));
    }
}

class KubernetesDataHolderFolder extends KubernetesResourceFolder {
    constructor(kind: kuberesources.ResourceKind) {
        super(kind);
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<KubernetesObject[]> {
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

    async getChildren(_kubectl: Kubectl, _host: Host): Promise<KubernetesObject[]> {
        if (!this.configData || this.configData.length === 0) {
            return [];
        }
        const files = Object.keys(this.configData);
        return files.map((f) => new KubernetesFileObject(this.configData, f, this.resource, this.id));
    }
}

export class KubernetesFileObject implements KubernetesObject {
    constructor(readonly configData: any, readonly id: string, readonly resource: string, readonly parentName: string) {
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.id, vscode.TreeItemCollapsibleState.None);
        treeItem.command = {
            command: "extension.vsKubernetesLoadConfigMapData",
            title: "Load",
            arguments: [this]
        };
        treeItem.contextValue = `vsKubernetes.file`;
        return treeItem;
    }

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<KubernetesObject[]> {
        return [];
    }
}

class HelmReleaseResource implements KubernetesObject {
    readonly id: string;

    constructor(readonly name: string, readonly status: string) {
        this.id = "helmrelease:" + name;
    }

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<KubernetesObject[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.name, vscode.TreeItemCollapsibleState.None);
        treeItem.command = {
            command: "extension.helmGet",
            title: "Get",
            arguments: [this]
        };
        treeItem.contextValue = "vsKubernetes.helmRelease";
        treeItem.iconPath = getIconForHelmRelease(this.status.toLowerCase());
        return treeItem;
    }
}

class HelmReleasesFolder extends KubernetesFolder {
    constructor() {
        super("Helm Release", "Helm Releases", "vsKubernetes.nonResourceFolder");
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<KubernetesObject[]> {
        if (!helmexec.ensureHelm(helmexec.EnsureMode.Silent)) {
            return [new DummyObject("Helm client is not installed")];
        }

        const currentNS = await kubectlUtils.currentNamespace(kubectl);

        const releases = await helmexec.helmListAll(currentNS);

        if (failed(releases)) {
            return [new DummyObject("Helm list error", releases.error[0])];
        }

        return releases.result.map((r) => new HelmReleaseResource(r.name, r.status));
    }
}
