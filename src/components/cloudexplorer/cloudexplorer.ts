import * as vscode from 'vscode';

import { CloudExplorerProvider } from './cloudexplorer.extension';
import * as providerResult from '../../utils/providerresult';
import { sleep } from '../../sleep';

export class CloudExplorer implements vscode.TreeDataProvider<CloudExplorerTreeNode> {
    private readonly providers = Array.of<CloudExplorerProvider>();

    private onDidChangeTreeDataEmitter: vscode.EventEmitter<CloudExplorerTreeNode | undefined> = new vscode.EventEmitter<CloudExplorerTreeNode | undefined>();
    readonly onDidChangeTreeData: vscode.Event<CloudExplorerTreeNode | undefined> = this.onDidChangeTreeDataEmitter.event;

    getTreeItem(element: CloudExplorerTreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (element.nodeType === 'cloud') {
            // TODO: unique context so providers can add commands to them
            return new vscode.TreeItem(element.provider.cloudName, vscode.TreeItemCollapsibleState.Collapsed);
        }
        return element.provider.treeDataProvider.getTreeItem(element.value);
    }

    getChildren(element?: CloudExplorerTreeNode | undefined): vscode.ProviderResult<CloudExplorerTreeNode[]> {
        if (!element) {
            // TODO: if no providers registered, display a message
            return this.providers.map(asCloudNode);
        }
        if (element.nodeType === 'cloud') {
            const children = element.provider.treeDataProvider.getChildren(undefined);
            return asContributed(children, element.provider);
        } else {
            const children = element.provider.treeDataProvider.getChildren(element.value);
            return asContributed(children, element.provider);
        }
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }

    register(provider: CloudExplorerProvider): void {
        this.providers.push(provider);
        sleep(50).then(() => vscode.commands.executeCommand('extension.vsKubernetesRefreshCloudExplorer'));
    }
}

export interface CloudExplorerCloudNode {
    readonly nodeType: 'cloud';
    readonly provider: CloudExplorerProvider;
}

export interface CloudExplorerContributedNode {
    readonly nodeType: 'contributed';
    readonly provider: CloudExplorerProvider;
    readonly value: any;
}

export type CloudExplorerTreeNode = CloudExplorerCloudNode | CloudExplorerContributedNode;

function asCloudNode(provider: CloudExplorerProvider): CloudExplorerCloudNode {
    return { nodeType: 'cloud', provider: provider };
}

function asContributed(elements: vscode.ProviderResult<any[]>, provider: CloudExplorerProvider): vscode.ProviderResult<CloudExplorerContributedNode[]> {
    return providerResult.map(elements, (e) => asContributedNode(e, provider));
}

function asContributedNode(element: any, provider: CloudExplorerProvider): CloudExplorerContributedNode {
    return { nodeType: 'contributed', provider: provider, value: element };
}
