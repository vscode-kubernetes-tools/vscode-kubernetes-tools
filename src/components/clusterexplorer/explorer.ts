import * as vscode from 'vscode';

import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import { affectsUs } from '../config/config';
import { ExplorerExtender, ExplorerUICustomizer } from './explorer.extension';
import * as providerResult from '../../utils/providerresult';
import { sleep } from '../../sleep';
import { refreshExplorer } from '../clusterprovider/common/explorer';
import { ClusterExplorerNode, ClusterExplorerResourceNode } from './node';
import { MiniKubeContextNode, ContextNode } from './node.context';

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
export type KubernetesExplorerNodeTypeExtension = 'extension';

export type KubernetesExplorerNodeType =
    KubernetesExplorerNodeTypeError |
    KubernetesExplorerNodeTypeContext |
    KubernetesExplorerNodeTypeResourceFolder |
    KubernetesExplorerNodeTypeGroupingFolder |
    KubernetesExplorerNodeTypeResource |
    KubernetesExplorerNodeTypeConfigItem |
    KubernetesExplorerNodeTypeHelmRelease |
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

    constructor(private readonly kubectl: Kubectl, private readonly host: Host) {
        host.onDidChangeConfiguration((change) => {
            if (affectsUs(change)) {
                this.refresh();
            }
        });
    }

    getTreeItem(element: ClusterExplorerNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const baseTreeItem = element.getTreeItem();

        const extensionAwareTreeItem = providerResult.transform(baseTreeItem, (ti) => {
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

    queueRefresh(): void {
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
