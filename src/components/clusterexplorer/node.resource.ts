import * as vscode from 'vscode';
import * as path from 'path';

import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { Pod, ObjectMeta } from '../../kuberesources.objectmodel';
import { kubefsUri } from '../../kuberesources.virtualfs';
import { ClusterExplorerNode, ClusterExplorerNodeImpl, ClusterExplorerResourceNode } from './node';
import { MessageNode } from './node.message';
import { resourceNodeCreate, getChildSources } from './resourcenodefactory';
import { ConfigurationValueNode } from './node.configurationvalue';
import { ConfigurationResourceNode } from './node.resource.configuration';

export abstract class ResourceNode extends ClusterExplorerNodeImpl implements ClusterExplorerResourceNode {
    readonly kindName: string;
    readonly nodeType = 'resource';
    constructor(readonly kind: kuberesources.ResourceKind, readonly name: string, readonly metadata: ObjectMeta | undefined) {
        super("resource");
        this.kindName = `${kind.abbreviation}/${name}`;
    }
    get namespace(): string | null {
        return (this.metadata && this.metadata.namespace) ? this.metadata.namespace : null;
    }
    uri(outputFormat: string): vscode.Uri {
        return kubefsUri(this.namespace, this.kindName, outputFormat);
    }
    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        const childSources = getChildSources(this.kind);
        const children = Array.of<ClusterExplorerNode>();
        for (const source of childSources) {
            switch (source) {
                case 'configdata':
                    const configitems = await listConfigItems(this.kind, this.name, (this as unknown as ConfigurationResourceNode).configData);
                    children.push(...configitems);
                    break;
                case 'pods':
                    const pods = await listPods(kubectl, (this as unknown as PodSelectingResourceNode).labelSelector);
                    children.push(...pods);
                    break;
                case 'podstatus':
                    const podStatusInfos = await listPodStatusItems(kubectl, this.name, this.namespace);
                    children.push(...podStatusInfos);
                    break;
            }
        }
        return children;
    }
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const collapsibleState = this.isExpandable ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        const treeItem = new vscode.TreeItem(this.name, collapsibleState);
        treeItem.iconPath = this.iconPath;
        treeItem.command = {
            command: "extension.vsKubernetesLoad",
            title: "Load",
            arguments: [this]
        };
        treeItem.contextValue = `vsKubernetes.resource.${this.kind.abbreviation}`;
        if (this.namespace) {
            treeItem.tooltip = `Namespace: ${this.namespace}`; // TODO: show only if in non-current namespace?
        }
        return treeItem;
    }
    get isExpandable(): boolean {
        return getChildSources(this.kind).length > 0;
    }
    get iconPath(): vscode.Uri | undefined {
        return undefined;
    }
}

async function listPodStatusItems(kubectl: Kubectl, podName: string, podNamespace: string | null): Promise<ClusterExplorerNode[]> {
    const nsarg = podNamespace ? `--namespace=${podNamespace}` : '';  // TODO: still not working!
    const result = await kubectl.asJson<Pod>(`get pods ${podName} ${nsarg} -o json`);
    if (result.succeeded) {
        const pod = result.result;
        let ready = 0;
        pod.status.containerStatuses.forEach((status) => {
            if (status.ready) {
                ready++;
            }
        });
        return [
            new MessageNode(`${pod.status.phase} (${ready}/${pod.status.containerStatuses.length})`),
            new MessageNode(pod.status.podIP),
        ];
    }
    else {
        return [new MessageNode("Error", result.error[0])];
    }
}

async function listConfigItems(parentKind: kuberesources.ResourceKind, parentName: string, configData: any): Promise<ClusterExplorerNode[]> {
    if (!configData || configData.length === 0) {
        return [];
    }
    const files = Object.keys(configData);
    return files.map((f) => new ConfigurationValueNode(configData, f, parentKind, parentName));
}

async function listPods(kubectl: Kubectl, labelSelector: any): Promise<ClusterExplorerNode[]> {
    if (!labelSelector) {
        return [];
    }
    const pods = await kubectlUtils.getPods(kubectl, labelSelector);
    return pods.map((p) => resourceNodeCreate(kuberesources.allKinds.pod, p.name, p.metadata, p));
}

export class SimpleResourceNode extends ResourceNode {
    constructor(kind: kuberesources.ResourceKind, name: string, metadata: ObjectMeta | undefined) {
        super(kind, name, metadata);
    }
}

export class PodResourceNode extends ResourceNode {
    constructor(name: string, metadata: ObjectMeta | undefined, private readonly podInfo: kubectlUtils.PodInfo) {
        super(kuberesources.allKinds.pod, name, metadata);
    }
    get iconPath() {
        if (this.podInfo && this.podInfo.status) {
            return getIconForPodStatus(this.podInfo.status.toLowerCase());
        }
        return undefined;
    }
}

export class PodSelectingResourceNode extends ResourceNode {
    constructor(kind: kuberesources.ResourceKind, name: string, metadata: ObjectMeta | undefined, readonly labelSelector: any) {
        super(kind, name, metadata);
    }
}

function getIconForPodStatus(status: string): vscode.Uri {
    if (status === "running" || status === "completed") {
        return vscode.Uri.file(path.join(__dirname, "../../../../images/runningPod.svg"));
    } else {
        return vscode.Uri.file(path.join(__dirname, "../../../../images/errorPod.svg"));
    }
}
