import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { affectsUs } from '../config/config';
import { ExplorerExtender, ExplorerUICustomizer } from './explorer.extension';
import * as providerResult from '../../utils/providerresult';
import { sleep } from '../../sleep';
import { refreshExplorer } from '../clusterprovider/common/explorer';
import { ClusterExplorerNode, ClusterExplorerResourceNode } from './node';
import { MiniKubeContextNode, ContextNode } from './node.context';
import { ResourceNode } from './node.resource';
import { ResourceFolderNode } from './node.folder.resource';

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

// export function createKubernetesResourceFolder(kind: kuberesources.ResourceKind): ClusterExplorerNode {
//     return new ResourceFolderNode(kind);
// }

// export function createKubernetesResource(kind: kuberesources.ResourceKind, id: string, metadata?: any): ClusterExplorerNode {
//     return new ResourceNode(kind, id, metadata);
// }

export function isKubernetesExplorerResourceNode(obj: any): obj is ClusterExplorerResourceNode {
    return obj && obj.nodeCategory === KUBERNETES_EXPLORER_NODE_CATEGORY && obj.nodeType === 'resource';
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

export class KubernetesSelectsPodsFolder extends ResourceFolderNode {
    constructor(readonly kind: kuberesources.ResourceKind) {
        super(kind);
    }

    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const objects = await kubectlUtils.getResourceWithSelector(this.kind.abbreviation, kubectl);
        return objects.map((obj) => new KubernetesSelectorResource(this.kind, obj.name, obj, obj.selector));
    }
}

class KubernetesSelectorResource extends ResourceNode {
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
