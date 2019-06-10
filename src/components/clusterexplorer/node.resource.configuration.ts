import * as kuberesources from '../../kuberesources';
import { ResourceNode } from './node.resource';
import { ObjectMeta } from '../../kuberesources.objectmodel';

export class ConfigurationResourceNode extends ResourceNode {
    constructor(kind: kuberesources.ResourceKind, name: string, metadata: ObjectMeta | undefined, data?: any) {
        super(kind, name, metadata, { configData: data });
    }
}
