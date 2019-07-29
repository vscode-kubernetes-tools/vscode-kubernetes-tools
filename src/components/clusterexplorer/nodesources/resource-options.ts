import * as kuberesources from '../../../kuberesources';

import { ClusterExplorerResourceNode } from '../node';
import { GetResourceNodesOptions } from '../node.folder.resource';
import { ResourceNode } from '../node.resource';
import { ResourceLister, CustomResourceChildSources } from '../resourceui';
import { Kubectl } from '../../../kubectl';
import { MessageNode } from '../node.message';

export interface ExtensionError {
    readonly errorMessage: string;
}

export interface ResourceListEntry {
    readonly name: string;
    readonly customData?: any;
}

export interface ResourcesNodeSourceOptions {
    readonly lister?: () => Promise<ResourceListEntry[] | ExtensionError>;
    readonly filter?: (o: ClusterExplorerResourceNode) => boolean;
    readonly childSources?: CustomResourceChildSources;
}

function isErrorMessage(o: ResourceListEntry[] | ExtensionError): o is ExtensionError {
    return !!((o as ExtensionError).errorMessage);
}

export function adaptOptions(options: ResourcesNodeSourceOptions | undefined): GetResourceNodesOptions {
    if (!options) {
        return {};
    }

    const lister = options.lister;
    const listerObj: ResourceLister | undefined = lister ? {
        async list(_kubectl: Kubectl, kind: kuberesources.ResourceKind) {
            const infos = await lister();
            if (isErrorMessage(infos)) {
                return [new MessageNode('Error', infos.errorMessage)];
            }
            return infos.map((i) => ResourceNode.createForCustom(kind, i.name, i.customData, options.childSources));
        }
    } : undefined;

    const optionsImpl = {
        lister: listerObj,
        filter: options.filter,
        childSources: options.childSources,
    };
    return optionsImpl;
}
