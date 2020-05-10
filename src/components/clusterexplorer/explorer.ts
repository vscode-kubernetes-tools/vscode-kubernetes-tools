import { clearTimeout, setTimeout } from 'timers';
import * as vscode from 'vscode';
import { Host } from '../../host';
import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { sleep } from '../../sleep';
import * as providerResult from '../../utils/providerresult';
import { refreshExplorer } from '../clusterprovider/common/explorer';
import { affectsUs, getResourcesToBeWatched } from '../config/config';
import { WatchManager } from '../kubectl/watch';
import { ExplorerExtender, ExplorerUICustomizer } from './explorer.extension';
import { ClusterExplorerNode, ClusterExplorerResourceNode } from './node';
import { ContextNode, MiniKubeContextNode } from './node.context';

// Each item in the explorer is modelled as a ClusterExplorerNode.  This
// is a discriminated union, using a nodeType field as its discriminator.
// This module defines the discriminators and the union type, and contains
// the top level of the explorer.  Individual modules using the 'node.*.ts'
// naming convention go on to define individual node types; additionally,
// 'node.ts' defines interface types which are intended as the primary way for
// consumers of the explorer to obtain data about nodes.
//
// Most node types are pretty self-contained in terms of their behaviour
// and their display.  The exception is resource nodes which sometimes
// need to gather additional information, display additional children
// and customise their display behaviour.  This is done via 'resource kind
// UI descriptors' in the 'resourceui.ts' file directory.  The ResourceNode
// type is always instantiated via a factory method which automatically loads
// the right descriptor for the resource kind; this allows parents that want
// to display resource children to be agnostic about what information those
// children need in order to render themselves and their own children.
//
// This module also contains the handling for the cross-cutting concern
// of API extensibility.  It implements extender registration, and takes
// care of invoking extenders around the delegated calls to node types.

export const KUBERNETES_EXPLORER_NODE_CATEGORY = 'kubernetes-explorer-node';

export type KubernetesExplorerNodeTypeError = 'error';
export type KubernetesExplorerNodeTypeContext = 'context';
export type KubernetesExplorerNodeTypeResourceFolder = 'folder.resource';
export type KubernetesExplorerNodeTypeGroupingFolder = 'folder.grouping';
export type KubernetesExplorerNodeTypeResource = 'resource';
export type KubernetesExplorerNodeTypeConfigItem = 'configitem';
export type KubernetesExplorerNodeTypeHelmRelease = 'helm.release';
export type KubernetesExplorerNodeTypeHelmHistory = 'helm.history';
export type KubernetesExplorerNodeTypeExtension = 'extension';

export type KubernetesExplorerNodeType =
    KubernetesExplorerNodeTypeError |
    KubernetesExplorerNodeTypeContext |
    KubernetesExplorerNodeTypeResourceFolder |
    KubernetesExplorerNodeTypeGroupingFolder |
    KubernetesExplorerNodeTypeResource |
    KubernetesExplorerNodeTypeConfigItem |
    KubernetesExplorerNodeTypeHelmRelease |
    KubernetesExplorerNodeTypeHelmHistory |
    KubernetesExplorerNodeTypeExtension;

export const NODE_TYPES = {
    error: 'error',
    context: 'context',
    folder: {
        resource: 'folder.resource',
        grouping: 'folder.grouping',
    },
    resource: 'resource',
    configitem: 'configitem',
    helm: {
        release: 'helm.release',
        history: 'helm.history',
    },
    extension: 'extension'
} as const;

export function create(kubectl: Kubectl, host: Host): KubernetesExplorer {
    return new KubernetesExplorer(kubectl, host);
}

export function isKubernetesExplorerResourceNode(obj: any): obj is ClusterExplorerResourceNode {
    return obj && obj.nodeCategory === KUBERNETES_EXPLORER_NODE_CATEGORY && obj.nodeType === 'resource';
}

export class KubernetesExplorer implements vscode.TreeDataProvider<ClusterExplorerNode> {
    private onDidChangeTreeDataEmitter: vscode.EventEmitter<ClusterExplorerNode | undefined> = new vscode.EventEmitter<ClusterExplorerNode | undefined>();
    readonly onDidChangeTreeData: vscode.Event<ClusterExplorerNode | undefined> = this.onDidChangeTreeDataEmitter.event;

    private readonly extenders = Array.of<ExplorerExtender<ClusterExplorerNode>>();
    private readonly customisers = Array.of<ExplorerUICustomizer<ClusterExplorerNode>>();
    private refreshTimer: NodeJS.Timer;
    private readonly refreshQueue = Array<ClusterExplorerNode>();

    constructor(private readonly kubectl: Kubectl, private readonly host: Host) {
        host.onDidChangeConfiguration((change) => {
            if (affectsUs(change)) {
                this.refresh();
            }
        });
    }

    initialize() {
        const viewer = vscode.window.createTreeView('extension.vsKubernetesExplorer', {
            treeDataProvider: this
        });
        return vscode.Disposable.from(
			viewer,
            viewer.onDidCollapseElement(this.onElementCollapsed, this),
            viewer.onDidExpandElement(this.onElementExpanded, this)
        );
    }

    getTreeItem(element: ClusterExplorerNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const baseTreeItem = element.getTreeItem();

        const extensionAwareTreeItem = providerResult.transform(baseTreeItem, (ti) => {
            if ('kind' in element && 'apiName' in element.kind && element.kind.apiName) {
                ti.contextValue += 'k8s-watchable';
            }
            if (ti.collapsibleState === vscode.TreeItemCollapsibleState.None && this.extenders.some((e) => e.contributesChildren(element))) {
                ti.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            }
        });

        let customisedTreeItem = extensionAwareTreeItem;
        for (const c of this.customisers) {
            customisedTreeItem = providerResult.transformPossiblyAsync(extensionAwareTreeItem, (ti) => c.customize(element, ti));
        }
        return customisedTreeItem;
    }

    getChildren(parent?: ClusterExplorerNode): vscode.ProviderResult<ClusterExplorerNode[]> {
        const baseChildren = this.getChildrenBase(parent);
        const contributedChildren = this.extenders
                                        .filter((e) => e.contributesChildren(parent))
                                        .map((e) => e.getChildren(parent));
        return providerResult.append(baseChildren, ...contributedChildren);
    }

    async watch(node: ClusterExplorerNode): Promise<void> {
        const id = this.getIdForWatch(node);
        if (!id) {
            console.log('Failed getting id for watch.');
            return;
        }
        const namespace = await kubectlUtils.currentNamespace(this.kubectl);
        const apiUri = await node.apiURI(this.kubectl, namespace);
        if (!apiUri) {
            console.log('Api URI is not valid.');
            return;
        }
        const onWatchNotification = (type: string, _obj: any) => {
            if (type) {
                this.queueRefresh(node);
            }
        };

        WatchManager.instance().addWatch(id, apiUri, undefined, onWatchNotification);
    }

    stopWatching(node: ClusterExplorerNode): void
    {
        const id = this.getIdForWatch(node);
        if (id) {
            WatchManager.instance().removeWatch(id);
        }
    }

    private getChildrenBase(parent?: ClusterExplorerNode): vscode.ProviderResult<ClusterExplorerNode[]> {
        if (parent) {
            return parent.getChildren(this.kubectl, this.host);
        }
        return this.getClusters();
    }

    refresh(node?: ClusterExplorerNode): void {
        this.onDidChangeTreeDataEmitter.fire(node);
    }

    registerExtender(extender: ExplorerExtender<ClusterExplorerNode>): void {
        this.extenders.push(extender);
        if (extender.contributesChildren(undefined)) {
            this.queueRefresh();
        }
        // TODO: VS Code now doesn't require a reload on extension install.  Do we need
        // to listen for the extension install event and refresh, in case a newly installed
        // extension registers a contributor while the tree view is already open?
    }

    registerUICustomiser(customiser: ExplorerUICustomizer<ClusterExplorerNode>): void {
        this.customisers.push(customiser);
        this.queueRefresh();
    }

    queueRefresh(node?: ClusterExplorerNode): void {
        if (!node) {
            // In the case where an extender contributes at top level (sibling to cluster nodes),
            // the tree view can populate before the extender has time to register.  So in this
            // case we need to kick off a refresh.  But... it turns out that if we just fire the
            // change event, VS Code goes 'oh well I'm just drawing the thing now so I'll be
            // picking up the change, no need to repopulate a second time.'  Even with a delay
            // there's a race condition.  But it seems that if we pipe it through the refresh
            // *command* (as refreshExplorer does) then it seems to work... ON MY MACHINE TM anyway.
            //
            // Refresh after registration is also a consideration for customisers, but we don't know
            // whether they're  interested in the top level so we have to err on the side of caution
            // and always queue a refresh.
            //
            // These are pretty niche cases, so I'm not too worried if they aren't perfect.
            sleep(50).then(() => refreshExplorer());
        } else {
            const currentNodeId = this.getIdForWatch(node);
            if (!currentNodeId) {
                return;
            }
            // In the case where many requests of updating are received in a short amount of time
            // the tree is not refreshed for every change but once after a while.
            // Every call resets a timer which trigger the tree refresh
            clearTimeout(this.refreshTimer);
            // check if element already is in refreshqueue before pushing it
            const alreadyInQueue = this.refreshQueue.some((queueEntry) => currentNodeId === this.getIdForWatch(queueEntry));
            if (!alreadyInQueue) {
                this.refreshQueue.push(node);
            }
            this.refreshTimer = setTimeout(() => {
                this.refreshQueue.splice(0).forEach((n) => this.refresh(n));
            }, 500);
        }
    }

    private onElementCollapsed(e: vscode.TreeViewExpansionEvent<ClusterExplorerNode>) {
        this.collapse(e.element);
	}

	private onElementExpanded(e: vscode.TreeViewExpansionEvent<ClusterExplorerNode>) {
        this.expand(e.element);
    }

    private expand(node: ClusterExplorerNode) {
        const watchId = this.getIdForWatch(node);
        const treeItem = node.getTreeItem();
        providerResult.transform(treeItem, (ti) => {
            if (this.shouldCreateWatch(ti.label, watchId)) {
                this.watch(node);
            }
        });
    }

    private collapse(node: ClusterExplorerNode) {
        const watchId = this.getIdForWatch(node);
        if (watchId && WatchManager.instance().existsWatch(watchId)) {
            WatchManager.instance().removeWatch(watchId);
        }
    }

    private shouldCreateWatch(label: string | undefined, watchId: string | undefined): boolean {
        if (!watchId) {
            return false;
        }
        if (WatchManager.instance().existsWatch(watchId)) {
            return true;
        }
        const resourcesToWatch = getResourcesToBeWatched();
        if (label &&
            resourcesToWatch.length > 0 &&
            resourcesToWatch.indexOf(label) !== -1) {
            return true;
        }
        return false;
    }

    public getIdForWatch(node: ClusterExplorerNode): string | undefined {
        switch (node.nodeType) {
            case 'folder.resource': {
                return node.kind.abbreviation;
            }
            case 'resource': {
                return node.kindName;
            }
            default: {
                break;
            }
        }
        return undefined;
    }

    private async getClusters(): Promise<ClusterExplorerNode[]> {
        const contexts = await kubectlUtils.getContexts(this.kubectl, { silent: false });  // TODO: turn it silent, cascade errors, and provide an error node
        return contexts.map((context) => {
            // TODO: this is slightly hacky...
            if (context.contextName === 'minikube') {
                return new MiniKubeContextNode(context.contextName, context);
            }

            return new ContextNode(context.contextName, context);
        });
    }
}
