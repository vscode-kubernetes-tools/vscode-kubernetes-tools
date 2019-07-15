import { Kubectl } from '../../kubectl';
import * as kubectlUtils from '../../kubectlUtils';
import { Host } from '../../host';
import { failed } from '../../errorable';
import { ClusterExplorerNode } from './node';
import { MessageNode } from './node.message';
import { HelmReleaseNode } from './node.helmrelease';
import { GroupingFolderNode } from './node.folder.grouping';
import * as helmexec from '../../helm.exec';

export class HelmReleasesFolder extends GroupingFolderNode /* TODO: not really */ {
    constructor() {
        super("Helm Release", "Helm Releases", "vsKubernetes.nonResourceFolder"); // TODO: folder.grouping is not quite right... but...
    }
    async getChildren(kubectl: Kubectl, _host: Host): Promise<ClusterExplorerNode[]> {
        if (!helmexec.ensureHelm(helmexec.EnsureMode.Silent)) {
            return [new MessageNode("Helm client is not installed")];
        }
        const currentNS = await kubectlUtils.currentNamespace(kubectl);
        const releases = await helmexec.helmListAll(currentNS);
        if (failed(releases)) {
            return [new MessageNode("Helm list error", releases.error[0])];
        }
        return releases.result.map((r) => new HelmReleaseNode(r.name, r.status));
    }
}
