import * as path from 'path';
import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { failed } from '../../errorable';
import * as helmexec from '../../helm.exec';
import { CRD } from '../../kuberesources.objectmodel';
import { affectsUs } from '../config/config';
import { ExplorerExtender, ExplorerUICustomizer } from './explorer.extension';
import * as providerResult from '../../utils/providerresult';
import { sleep } from '../../sleep';
import { refreshExplorer } from '../clusterprovider/common/explorer';
import { flatten } from '../../utils/array';
import { ClusterExplorerNode, KubernetesExplorerNodeImpl } from './node';
import { ErrorNode } from './node.error';
import { MiniKubeContextNode, ContextNode } from './node.context';
import { FolderNode } from './node.folder';
import { ClusterExplorerResourceNode } from './node.resource';
import { HelmReleaseNode } from './node.helmrelease';
import { ResourceFolderNode } from './node.folder.resource';
import { NodeClusterExplorerNode } from './node.resource.node';
import { NamespaceResourceNode } from './node.resource.namespace';

export const KUBERNETES_CLUSTER = "vsKubernetes.cluster";
export const MINIKUBE_CLUSTER = "vsKubernetes.minikubeCluster";

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
    return new ResourceFolderNode(kind);
}

export function createKubernetesResource(kind: kuberesources.ResourceKind, id: string, metadata?: any): ClusterExplorerNode {
    return new ClusterExplorerResourceNode(kind, id, metadata);
}

export function getIconForHelmRelease(status: string): vscode.Uri {
    if (status === "deployed") {
        return vscode.Uri.file(path.join(__dirname, "../../images/helmDeployed.svg"));
    } else {
        return vscode.Uri.file(path.join(__dirname, "../../images/helmFailed.svg"));
    }
}

export function getIconForPodStatus(status: string): vscode.Uri {
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

            return new ContextNode(context.contextName, context);
        });
    }
}

export class KubernetesNodeFolder extends ResourceFolderNode {
    constructor() {
        super(kuberesources.allKinds.node);
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const nodes = await kubectlUtils.getGlobalResources(kubectl, 'nodes');
        return nodes.map((node) => new NodeClusterExplorerNode(node.metadata.name, node));
    }
}

export class KubernetesNamespaceFolder extends ResourceFolderNode {
    constructor() {
        super(kuberesources.allKinds.namespace);
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const namespaces = await kubectlUtils.getNamespaces(kubectl);
        return namespaces.map((ns) => new NamespaceResourceNode(this.kind, ns.name, ns));
    }
}

export class KubernetesSelectsPodsFolder extends ResourceFolderNode {
    constructor(readonly kind: kuberesources.ResourceKind) {
        super(kind);
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const objects = await kubectlUtils.getResourceWithSelector(this.kind.abbreviation, kubectl);
        return objects.map((obj) => new KubernetesSelectorResource(this.kind, obj.name, obj, obj.selector));
    }
}

export class KubernetesCRDFolder extends FolderNode {
    constructor() {
        super("folder.grouping", kuberesources.allKinds.crd.abbreviation, kuberesources.allKinds.crd.pluralDisplayName);
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const objects = await kubectlUtils.getCRDTypes(kubectl);
        return objects.map((obj) => new ResourceFolderNode(this.customResourceKind(obj)));
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

class KubernetesSelectorResource extends ClusterExplorerResourceNode {
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
        return pods.map((p) => new ClusterExplorerResourceNode(kuberesources.allKinds.pod, p.name, p));
    }
}

export class KubernetesDataHolderFolder extends ResourceFolderNode {
    constructor(kind: kuberesources.ResourceKind) {
        super(kind);
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const namespaces = await kubectlUtils.getDataHolders(this.kind.abbreviation, kubectl);
        return namespaces.map((cm) => new KubernetesDataHolderResource(this.kind, cm.metadata.name, cm, cm.data));
    }
}

export class KubernetesDataHolderResource extends ClusterExplorerResourceNode {
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

export class HelmReleasesFolder extends FolderNode {
    constructor() {
        super("folder.grouping", "Helm Release", "Helm Releases", "vsKubernetes.nonResourceFolder");  // TODO: folder.grouping is not quite right... but...
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        if (!helmexec.ensureHelm(helmexec.EnsureMode.Silent)) {
            return [new ErrorNode("Helm client is not installed")];
        }

        const currentNS = await kubectlUtils.currentNamespace(kubectl);

        const releases = await helmexec.helmListAll(currentNS);

        if (failed(releases)) {
            return [new ErrorNode("Helm list error", releases.error[0])];
        }

        return releases.result.map((r) => new HelmReleaseNode(r.name, r.status));
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
        return [new ResourceFolderNode(this.resourceKind)];
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
            return parent.nodeType === 'folder.grouping' && (parent as FolderNode).displayName === this.under;
        }
        return parent.nodeType === 'context' && (parent as ContextNode).metadata.active;
    }

    getChildren(_parent?: ClusterExplorerNode | undefined): Promise<ClusterExplorerNode[]> {
        return this.nodeSource.nodes();
    }
}

class CustomGroupingFolder extends FolderNode {
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
