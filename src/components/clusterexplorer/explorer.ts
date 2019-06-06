import * as path from 'path';
import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { failed } from '../../errorable';
import * as helmexec from '../../helm.exec';
import { Pod, CRD } from '../../kuberesources.objectmodel';
import { kubefsUri } from '../../kuberesources.virtualfs';
import { affectsUs } from '../config/config';
import { ExplorerExtender, ExplorerUICustomizer } from './explorer.extension';
import * as providerResult from '../../utils/providerresult';
import { sleep } from '../../sleep';
import { refreshExplorer } from '../clusterprovider/common/explorer';
import { flatten } from '../../utils/array';
import { ClusterExplorerNode } from './node';

const KUBERNETES_CLUSTER = "vsKubernetes.cluster";
const MINIKUBE_CLUSTER = "vsKubernetes.minikubeCluster";

export const KUBERNETES_EXPLORER_NODE_CATEGORY = 'kubernetes-explorer-node';

export type KubernetesExplorerNodeType =
    'error' |
    'context' |
    'folder.resource' |
    'folder.grouping' |
    'resource' |
    'configitem' |
    'helm.release' |
    'extension';

export function create(kubectl: Kubectl, host: Host): KubernetesExplorer {
    return new KubernetesExplorer(kubectl, host);
}

export function createKubernetesResourceFolder(kind: kuberesources.ResourceKind): ClusterExplorerNode {
    return new KubernetesResourceFolder(kind);
}

export function createKubernetesResource(kind: kuberesources.ResourceKind, id: string, metadata?: any): ClusterExplorerNode {
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

export interface ResourceNode {
    readonly kind: kuberesources.ResourceKind;
    readonly id: string;
    readonly resourceId: string;
    uri(outputFormat: string): vscode.Uri;
    namespace: string | null;
}

export interface ResourceFolder {
    readonly kind: kuberesources.ResourceKind;
}

export function isKubernetesExplorerResourceNode(obj: any): obj is ResourceNode {
    return obj && obj.nodeCategory === KUBERNETES_EXPLORER_NODE_CATEGORY && obj.id && obj.resourceId;
}

export class KubernetesExplorer implements vscode.TreeDataProvider<ClusterExplorerNode> {
    private onDidChangeTreeDataEmitter: vscode.EventEmitter<ClusterExplorerNode | undefined> = new vscode.EventEmitter<ClusterExplorerNode | undefined>();
    readonly onDidChangeTreeData: vscode.Event<ClusterExplorerNode | undefined> = this.onDidChangeTreeDataEmitter.event;

    private readonly extenders = Array.of<ExplorerExtender<ClusterExplorerNode>>();
    private readonly customisers = Array.of<ExplorerUICustomizer<ClusterExplorerNode>>();

    constructor(private readonly kubectl: Kubectl, private readonly host: Host) {
        host.onDidChangeConfiguration((change) => {
            if (affectsUs(change)) {
                this.refresh();
            }
        });
    }

    getTreeItem(element: ClusterExplorerNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = element.getTreeItem();
        // TODO: we need to allow people to distinguish active from inactive cluster nodes,
        // and if someone expands an inactive cluster because it has been extended, they
        // should NOT get all the folder nodes.
        const treeItem2 = providerResult.transform(treeItem, (ti) => {
            if (ti.collapsibleState === vscode.TreeItemCollapsibleState.None && this.extenders.some((e) => e.contributesChildren(element))) {
                ti.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            }
        });

        let treeItem3 = treeItem2;
        for (const c of this.customisers) {
            treeItem3 = providerResult.transformPossiblyAsync(treeItem2, (ti) => c.customize(element, ti));
        }
        return treeItem3;
}

    getChildren(parent?: ClusterExplorerNode): vscode.ProviderResult<ClusterExplorerNode[]> {
        const baseChildren = this.getChildrenBase(parent);
        const contributedChildren = this.extenders
                                        .filter((e) => e.contributesChildren(parent))
                                        .map((e) => e.getChildren(parent));
        return providerResult.append(baseChildren, ...contributedChildren);
    }

    private getChildrenBase(parent?: ClusterExplorerNode): vscode.ProviderResult<ClusterExplorerNode[]> {
        if (parent) {
            return parent.getChildren(this.kubectl, this.host);
        }
        return this.getClusters();
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }

    registerExtender(extender: ExplorerExtender<ClusterExplorerNode>): void {
        this.extenders.push(extender);
        // In the case where an extender contributes at top level (sibling to cluster nodes),
        // the tree view can populate before the extender has time to register.  So in this
        // case we need to kick off a refresh.  But... it turns out that if we just fire the
        // change event, VS Code goes 'oh well I'm just drawing the thing now so I'll be
        // picking up the change, no need to repopulate a second time.'  Even with a delay
        // there's a race condition.  But it seems that if we pipe it through the refresh
        // *command* (as refreshExplorer does) then it seems to work... ON MY MACHINE TM anyway.
        //
        // This is a pretty niche case, so I'm not too worried if this isn't perfect.
        //
        // TODO: VS Code now doesn't require a reload on extension install.  Do we need
        // to listen for the extension install event and refresh, in case an extension
        // attempts to contribute while the tree view is already open?
        //
        // TODO: we need to check collapsibleStates in case someone adds child nodes to a
        // parent which currently has CollapsibleState.None.
        if (extender.contributesChildren(undefined)) {
            sleep(50).then(() => refreshExplorer());
        }
    }

    registerUICustomiser(customiser: ExplorerUICustomizer<ClusterExplorerNode>): void {
        this.customisers.push(customiser);
        sleep(50).then(() => refreshExplorer());
    }

    private async getClusters(): Promise<ClusterExplorerNode[]> {
        const contexts = await kubectlUtils.getContexts(this.kubectl);
        return contexts.map((context) => {
            // TODO: this is slightly hacky...
            if (context.contextName === 'minikube') {
                return new MiniKubeContextNode(context.contextName, context);
            }

            return new KubernetesContextNode(context.contextName, context);
        });
    }
}

class KubernetesExplorerNodeImpl {
    readonly nodeCategory = KUBERNETES_EXPLORER_NODE_CATEGORY;
    constructor(readonly nodeType: KubernetesExplorerNodeType) {}
}

/**
 * Dummy object will be displayed as a placeholder in the tree explorer. Cannot be expanded and has no action menus on it.
 * For example, display an "Error" dummy node when failing to get children of expandable parent.
 */
class DummyObject extends KubernetesExplorerNodeImpl implements ClusterExplorerNode {
    constructor(readonly id: string, readonly diagnostic?: string) {
        super('error');
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.id, vscode.TreeItemCollapsibleState.None);
        if (this.diagnostic) {
            treeItem.tooltip = this.diagnostic;
        }
        return treeItem;
    }

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [];
    }
}

class KubernetesContextNode extends KubernetesExplorerNodeImpl implements ClusterExplorerNode {

    constructor(readonly id: string, readonly metadata: kubectlUtils.KubectlContext) {
        super('context');
    }

    get icon(): vscode.Uri {
        return vscode.Uri.file(path.join(__dirname, "../../images/k8s-logo.png"));
    }

    get clusterType(): string {
        return KUBERNETES_CLUSTER;
    }

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        if (this.metadata.active) {
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
        return [];
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

abstract class KubernetesFolder extends KubernetesExplorerNodeImpl implements ClusterExplorerNode {
    constructor(readonly nodeType: KubernetesExplorerNodeType, readonly id: string, readonly displayName: string, readonly contextValue?: string) {
        super(nodeType);
    }

    abstract getChildren(kubectl: Kubectl, host: Host): vscode.ProviderResult<ClusterExplorerNode[]>;

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.displayName, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = this.contextValue || `vsKubernetes.${this.id}`;
        return treeItem;
    }
}

class KubernetesWorkloadFolder extends KubernetesFolder {
    constructor() {
        super("folder.grouping", "workload", "Workloads");
    }

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
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
        super("folder.grouping", "config", "Configuration");
    }

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            new KubernetesDataHolderFolder(kuberesources.allKinds.configMap),
            new KubernetesDataHolderFolder(kuberesources.allKinds.secret)
        ];
    }
}

class KubernetesNetworkFolder extends KubernetesFolder {
    constructor() {
        super("folder.grouping", "network", "Network");
    }

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            new KubernetesSelectsPodsFolder(kuberesources.allKinds.service),
            new KubernetesResourceFolder(kuberesources.allKinds.endpoint),
            new KubernetesResourceFolder(kuberesources.allKinds.ingress),
        ];
    }
}

class KubernetesStorageFolder extends KubernetesFolder {
    constructor() {
        super("folder.grouping", "storage", "Storage");
    }

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [
            new KubernetesResourceFolder(kuberesources.allKinds.persistentVolume),
            new KubernetesResourceFolder(kuberesources.allKinds.persistentVolumeClaim),
            new KubernetesResourceFolder(kuberesources.allKinds.storageClass),
        ];
    }
}

class KubernetesResourceFolder extends KubernetesFolder implements ResourceFolder {
    constructor(readonly kind: kuberesources.ResourceKind) {
        super("folder.resource", kind.abbreviation, kind.pluralDisplayName, "vsKubernetes.kind");
    }

    async getChildren(kubectl: Kubectl, host: Host): Promise<ClusterExplorerNode[]> {
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

class KubernetesResource extends KubernetesExplorerNodeImpl implements ClusterExplorerNode, ResourceNode {
    readonly resourceId: string;

    constructor(readonly kind: kuberesources.ResourceKind, readonly id: string, readonly metadata?: any) {
        super("resource");
        this.resourceId = `${kind.abbreviation}/${id}`;
    }

    get namespace(): string | null {
        return (this.metadata && this.metadata.namespace) ? this.metadata.namespace : null;
    }

    uri(outputFormat: string): vscode.Uri {
        return kubefsUri(this.namespace, this.resourceId, outputFormat);
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

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
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

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const pods = await kubectlUtils.getPods(kubectl, null, 'all');
        const filteredPods = pods.filter((p) => `node/${p.nodeName}` === this.resourceId);
        return filteredPods.map((p) => new KubernetesResource(kuberesources.allKinds.pod, p.name, p));
    }
}

class KubernetesNamespaceFolder extends KubernetesResourceFolder {
    constructor() {
        super(kuberesources.allKinds.namespace);
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
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

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const objects = await kubectlUtils.getResourceWithSelector(this.kind.abbreviation, kubectl);
        return objects.map((obj) => new KubernetesSelectorResource(this.kind, obj.name, obj, obj.selector));
    }
}

class KubernetesCRDFolder extends KubernetesFolder {
    constructor() {
        super("folder.grouping", kuberesources.allKinds.crd.abbreviation, kuberesources.allKinds.crd.pluralDisplayName);
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
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

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
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

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
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

    async getChildren(_kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        if (!this.configData || this.configData.length === 0) {
            return [];
        }
        const files = Object.keys(this.configData);
        return files.map((f) => new KubernetesFileObject(this.configData, f, this.resource, this.id));
    }
}

export class KubernetesFileObject extends KubernetesExplorerNodeImpl implements ClusterExplorerNode {
    constructor(readonly configData: any, readonly id: string, readonly resource: string, readonly parentName: string) {
        super("configitem");
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

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return [];
    }
}

class HelmReleaseResource extends KubernetesExplorerNodeImpl implements ClusterExplorerNode {
    readonly id: string;

    constructor(readonly name: string, readonly status: string) {
        super("helm.release");
        this.id = "helmrelease:" + name;
    }

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
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
        super("folder.grouping", "Helm Release", "Helm Releases", "vsKubernetes.nonResourceFolder");  // TODO: folder.grouping is not quite right... but...
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
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

export abstract class NodeSourceImpl {
    at(parent: string | undefined): ExplorerExtender<ClusterExplorerNode> {
        return new ContributedNodeSourceExtender(parent, this);
    }
    if(condition: () => boolean | Thenable<boolean>): NodeSourceImpl {
        return new ConditionalNodeSource(this, condition);
    }
    abstract nodes(): Promise<ClusterExplorerNode[]>;
}

export class CustomResourceFolderNodeSource extends NodeSourceImpl {
    constructor(private readonly resourceKind: kuberesources.ResourceKind) {
        super();
    }

    async nodes(): Promise<ClusterExplorerNode[]> {
        return [new KubernetesResourceFolder(this.resourceKind)];
    }
}

export class CustomGroupingFolderNodeSource extends NodeSourceImpl {
    constructor(
        private readonly displayName: string,
        private readonly contextValue: string | undefined,
        private readonly children: NodeSourceImpl[]
    ) {
        super();
    }

    async nodes(): Promise<ClusterExplorerNode[]> {
        return [new CustomGroupingFolder(this.displayName, this.contextValue, this.children)];
    }
}

class ConditionalNodeSource extends NodeSourceImpl {
    constructor(private readonly impl: NodeSourceImpl, private readonly condition: () => boolean | Thenable<boolean>) {
        super();
    }

    async nodes(): Promise<ClusterExplorerNode[]> {
        if (await this.condition()) {
            return this.impl.nodes();
        }
        return [];
    }
}

export class ContributedNodeSourceExtender implements ExplorerExtender<ClusterExplorerNode> {
    constructor(private readonly under: string | undefined, private readonly nodeSource: NodeSourceImpl) {}

    contributesChildren(parent?: ClusterExplorerNode | undefined): boolean {
        if (!parent) {
            return false;
        }
        if (this.under) {
            return parent.nodeType === 'folder.grouping' && (parent as KubernetesFolder).displayName === this.under;
        }
        return parent.nodeType === 'context' && (parent as KubernetesContextNode).metadata.active;
    }

    getChildren(_parent?: ClusterExplorerNode | undefined): Promise<ClusterExplorerNode[]> {
        return this.nodeSource.nodes();
    }
}

class CustomGroupingFolder extends KubernetesFolder {
    constructor(displayName: string, contextValue: string | undefined, private readonly children: NodeSourceImpl[]) {
        super('folder.grouping', 'folder.grouping.custom', displayName, contextValue);
    }

    getChildren(_kubectl: Kubectl, _host: Host): vscode.ProviderResult<ClusterExplorerNode[]> {
        return this.getChildrenImpl();
    }

    private async getChildrenImpl(): Promise<ClusterExplorerNode[]> {
        const allNodesPromise = Promise.all(this.children.map((c) => c.nodes()));
        const nodeArrays = await allNodesPromise;
        const nodes = flatten(...nodeArrays);
        return nodes;
    }
}
