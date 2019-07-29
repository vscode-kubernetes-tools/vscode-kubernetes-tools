import { ResourceLister, CustomResourceChildSources } from "../resourceui";
import { ClusterExplorerResourceNode } from "../node";

export interface ExtensionError {
    readonly errorMessage: string;
}

export interface ResourceListEntry {
    readonly name: string;
    readonly customData?: any;
}

export interface GetResourceNodesOptions {
    readonly lister?: ResourceLister;
    readonly filter?: (o: ClusterExplorerResourceNode) => boolean;
    readonly childSources?: CustomResourceChildSources;
}
