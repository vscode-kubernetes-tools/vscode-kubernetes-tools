import * as kuberesources from '../../kuberesources';
import { ResourceNode } from './node.resource';
import { ObjectMeta } from '../../kuberesources.objectmodel';

export class ConfigurationResourceNode extends ResourceNode {
    readonly configData: any;
    constructor(kind: kuberesources.ResourceKind, name: string, metadata: ObjectMeta | undefined, readonly data?: any) {
        super(kind, name, metadata);
        this.configData = data;
    }
}
