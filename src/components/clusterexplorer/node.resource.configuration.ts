import { Kubectl } from '../../kubectl';
import { Host } from '../../host';
import * as kuberesources from '../../kuberesources';
import { ClusterExplorerNode } from './node';
import { ResourceNode } from './node.resource';
import { ConfigurationValueNode } from './node.configurationvalue';

export class ConfigurationResourceNode extends ResourceNode {
    readonly configData: any;
    constructor(readonly kind: kuberesources.ResourceKind, readonly name: string, readonly metadata?: any, readonly data?: any) {
        super(kind, name, metadata);
        this.configData = data;
    }
    async getChildren(_kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        if (!this.configData || this.configData.length === 0) {
            return [];
        }
        const files = Object.keys(this.configData);
        return files.map((f) => new ConfigurationValueNode(this.configData, f, this.kind, this.name));
    }

    get isExpandable() {
        return true;
    }
}
