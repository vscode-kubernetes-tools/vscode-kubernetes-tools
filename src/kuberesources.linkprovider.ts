import * as vscode from 'vscode';
import * as querystring from 'querystring';
import * as _ from 'lodash';

import * as kuberesources from './kuberesources';
import { kubefsUri } from './kuberesources.virtualfs';
import { helmfsUri } from './helm.exec';
import * as yl from './yaml-support/yaml-locator';

export class KubernetesResourceLinkProvider implements vscode.DocumentLinkProvider {
    provideDocumentLinks(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.DocumentLink[]> {
        const sourceKind = k8sKind(document);
        const yaml = yl.yamlLocator.getYamlDocuments(document);
        const leaves: yl.YamlNode[] = getLeafNodes(yaml);
        const links = leaves.choose((l) => getLink(document, sourceKind, l));
        return links;
    }
}

function getLeafNodes(yaml: yl.YamlDocument[]): yl.YamlNode[] {
    const rootNodes = _.flatMap(yaml, (d) => d.nodes);
    const nonRootNodes = _.flatMap(rootNodes, (n) => descendants(n));
    const allNodes = rootNodes.concat(nonRootNodes);
    const leafNodes = allNodes.filter((n) => isLeaf(n));
    return leafNodes;
}

function getLink(document: vscode.TextDocument, sourceKind: string, node: yl.YamlNode): vscode.DocumentLink | undefined {
    if (yl.isMappingItem(node)) {
        return getLinkFromPair(document, sourceKind, node);
    }
    return undefined;
}

function range(document: vscode.TextDocument, node: yl.YamlMappingItem) {
    return new vscode.Range(
        document.positionAt(node.value.startPosition),
        document.positionAt(node.value.endPosition)
    );
}

function descendants(node: yl.YamlNode): yl.YamlNode[] {
    const direct = children(node);
    const indirect = direct.map((n) => descendants(n));
    const all = direct.concat(...indirect);
    return all;
}

function children(node: yl.YamlNode): yl.YamlNode[] {
    if (yl.isMapping(node)) {
        return node.mappings;
    } else if (yl.isSequence(node)) {
        return node.items;
    } else if (yl.isMappingItem(node)) {
        if (yl.isMapping(node.value) || yl.isSequence(node.value)) {
            return [node.value];
        }
        return [];
    } else {
        return [];
    }
}

function isLeaf(node: yl.YamlNode): boolean {
    return yl.isMappingItem(node) && node.value.kind === 'SCALAR';
}

function key(node: yl.YamlNode): string | undefined {
    if (node && yl.isMappingItem(node)) {
        return node.key.raw;
    }
    return undefined;
}

function parentKey(node: yl.YamlNode): string | undefined {
    const parent = node.parent;
    if (!parent) {
        return undefined;
    }
    if (parent.parent && yl.isMapping(parent.parent)) {
        const parentPair = parent.parent.mappings.find((mi) => mi.value === parent)!;  // safe because we are looking for our own mapping
        const parentKey = key(parentPair);
        if (parentKey) {
            return parentKey;
        }
    }
    return parentKey(parent);
}

function siblings(node: yl.YamlMappingItem): yl.YamlMappingItem[] {
    const parent = node.parent;
    if (parent && yl.isMapping(parent)) {
        return parent.mappings;
    }
    return [];
}

function sibling(node: yl.YamlMappingItem, name: string): string | undefined {
    return siblings(node).filter((n) => n.key.raw === name)
                         .map((n) => n.value.raw)
                         [0];
}

function getLinkFromPair(document: vscode.TextDocument, sourceKind: string, node: yl.YamlMappingItem): vscode.DocumentLink | undefined {
    const uri = getLinkUri(sourceKind, node);
    if (!uri) {
        return undefined;
    }
    return new vscode.DocumentLink(range(document, node), uri);
}

function getLinkUri(sourceKind: string, node: yl.YamlMappingItem): vscode.Uri | undefined {
    // Things that apply to all source resource types
    if (key(node) === 'release' && parentKey(node) === 'labels') {
        return helmfsUri(node.value.raw, undefined);
    }
    if (key(node) === 'namespace' && parentKey(node) === 'metadata') {
        return kubefsUri(null, `ns/${node.value.raw}`, 'yaml');
    }
    if (key(node) === 'name' && parentKey(node) === 'ownerReferences') {
        const ownerKind = k8sKindFromManifestKind(sibling(node, 'kind'));
        if (ownerKind) {
            return kubefsUri(null, `${ownerKind}/${node.value.raw}`, 'yaml');
        }
    }

    // Source=type-specific navigation
    switch (sourceKind) {
        case kuberesources.allKinds.deployment.abbreviation:
            return getLinkUriFromDeployment(node);
        case kuberesources.allKinds.persistentVolume.abbreviation:
            return getLinkUriFromPV(node);
        case kuberesources.allKinds.persistentVolumeClaim.abbreviation:
            return getLinkUriFromPVC(node);
        default:
            return undefined;
    }
}

function getLinkUriFromDeployment(node: yl.YamlMappingItem): vscode.Uri | undefined {
    if (key(node) === 'claimName' && parentKey(node) === 'persistentVolumeClaim') {
        return kubefsUri(null, `pvc/${node.value.raw}`, 'yaml');
    } else if (key(node) === 'name' && parentKey(node) === 'configMap') {
        return kubefsUri(null, `cm/${node.value.raw}`, 'yaml');
    } else if (key(node) === 'name' && parentKey(node) === 'secretKeyRef') {
        return kubefsUri(null, `secrets/${node.value.raw}`, 'yaml');
    } else {
        return undefined;
    }
}

function getLinkUriFromPV(node: yl.YamlMappingItem): vscode.Uri | undefined {
    if (key(node) === 'storageClassName') {
        return kubefsUri(null, `sc/${node.value.raw}`, 'yaml');
    } else if (key(node) === 'name' && parentKey(node) === 'claimRef') {
        return kubefsUri(sibling(node, 'namespace'), `pvc/${node.value.raw}`, 'yaml');
    } else {
        return undefined;
    }
}

function getLinkUriFromPVC(node: yl.YamlMappingItem): vscode.Uri | undefined {
    if (key(node) === 'storageClassName') {
        return kubefsUri(null, `sc/${node.value.raw}`, 'yaml');
    } else if (key(node) === 'volumeName') {
        return kubefsUri(null, `pv/${node.value.raw}`, 'yaml');
    } else {
        return undefined;
    }
}

function k8sKind(document: vscode.TextDocument): string {
    const query = querystring.parse(document.uri.query);
    const k8sid = query.value as string;
    const kindSepIndex = k8sid.indexOf('/');
    return k8sid.substring(0, kindSepIndex);
}

function k8sKindFromManifestKind(manifestKind: string | undefined): string | undefined {
    if (!manifestKind) {
        return undefined;
    }
    const resourceKind = kuberesources.findKind(manifestKind);
    return resourceKind ? resourceKind.abbreviation : undefined;
}
