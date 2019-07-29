import { ClusterExplorerNode } from '../node';
import { Kubectl } from '../../../kubectl';
import { Host } from '../../../host';
import { NodeSource } from './nodesources';

export class ConditionalNodeSource extends NodeSource {
    constructor(private readonly impl: NodeSource, private readonly condition: () => boolean | Thenable<boolean>) {
        super();
    }
    async nodes(kubectl: Kubectl | undefined, host: Host | undefined): Promise<ClusterExplorerNode[]> {
        if (await this.condition()) {
            return this.impl.nodes(kubectl, host);
        }
        return [];
    }
}
