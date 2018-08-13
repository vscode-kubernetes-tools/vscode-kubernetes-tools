import * as vscode from 'vscode';
import * as querystring from 'querystring';

import * as kuberesources from './kuberesources';
import { findParentYaml } from './yaml-support/yaml-navigation';
import { kubefsUri } from './kuberesources.virtualfs';
import { helmfsUri } from './helm.exec';

export class KubernetesResourceDefinitionProvider implements vscode.DefinitionProvider {
    public provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition> {
        return this.provideDefinitionAsync(document, position);
    }

    async provideDefinitionAsync(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Definition> {
        // JOYOUS FACT: the YAML thingy does NOT give us symbols.  Let's kludge it for now.
        const currentLine = parseYamlLine(document, position.line);
        if (!currentLine || !currentLine.value) {
            return undefined;
        }

        const parentLineIndex = findParentYaml(document, position.line);
        const parentLine = parseYamlLine(document, parentLineIndex);

        // TODO: some sources can include namespaces references e.g. claimRef has name and namespace children
        const source = {
            key: currentLine.key,
            value: currentLine.value,
            parentKey: parentLine ? parentLine.key : undefined,
            kind: k8sKind(document)
        };

        const targetUri = findNavigationTarget(source);

        if (!targetUri) {
            return undefined;
        }

        return new vscode.Location(targetUri, new vscode.Position(0, 0));
    }
}

function findNavigationTarget(source: YAMLValueInContext): vscode.Uri | undefined {
    // Things that apply to all source resource types
    if (source.key === 'release' && source.parentKey === 'labels') {
        return helmfsUri(source.value);
    }
    if (source.key === 'namespace' && source.parentKey === 'metadata') {
        return kubefsUri(null, `ns/${source.value}`, 'yaml');
    }

    // Source=type-specific navigation
    switch (source.kind) {
        case kuberesources.allKinds.deployment.abbreviation:
            return findNavigationTargetFromDeployment(source);
        case kuberesources.allKinds.persistentVolume.abbreviation:
            return findNavigationTargetFromPV(source);
        case kuberesources.allKinds.persistentVolumeClaim.abbreviation:
            return findNavigationTargetFromPVC(source);
        default:
            return undefined;
    }
}

function findNavigationTargetFromDeployment(source: YAMLValueInContext): vscode.Uri | undefined {
    if (source.key === 'claimName' && source.parentKey === 'persistentVolumeClaim') {
        return kubefsUri(null, `pvc/${source.value}`, 'yaml');
    } else if (source.key === 'name' && source.parentKey === 'configMap') {
        return kubefsUri(null, `cm/${source.value}`, 'yaml');
    } else if (source.key === 'name' && source.parentKey === 'secretKeyRef') {
        return kubefsUri(null, `secrets/${source.value}`, 'yaml');
    } else {
        return undefined;
    }
}

function findNavigationTargetFromPV(source: YAMLValueInContext): vscode.Uri | undefined {
    if (source.key === 'storageClassName') {
        return kubefsUri(null, `sc/${source.value}`, 'yaml');
    } else if (source.key === 'name' && source.parentKey === 'claimRef') {
        return kubefsUri(null, `pvc/${source.value}`, 'yaml');
    } else {
        return undefined;
    }
}

function findNavigationTargetFromPVC(source: YAMLValueInContext): vscode.Uri | undefined {
    if (source.key === 'storageClassName') {
        return kubefsUri(null, `sc/${source.value}`, 'yaml');
    } else if (source.key === 'volumeName') {
        return kubefsUri(null, `pv/${source.value}`, 'yaml');
    } else {
        return undefined;
    }
}

function parseYamlLine(document: vscode.TextDocument, lineIndex: number): YAMLLine | undefined {
    const currentLine = document.lineAt(lineIndex).text.trim();
    const keySeparatorIndex = currentLine.indexOf(':');
    if (keySeparatorIndex < 0) {
        return undefined;
    }
    const key = currentLine.substring(0, keySeparatorIndex).trim();
    const value = currentLine.substring(keySeparatorIndex + 1).trim();
    return { key: nameOnly(key), value: value };
}

function k8sKind(document: vscode.TextDocument): string {
    const query = querystring.parse(document.uri.query);
    const k8sid: string = query.value;
    const kindSepIndex = k8sid.indexOf('/');
    return k8sid.substring(0, kindSepIndex);
}

const YAML_SECTION_WART = '- ';

function nameOnly(key: string): string {
    if (key.startsWith(YAML_SECTION_WART)) {
        return key.substring(YAML_SECTION_WART.length);
    }
    return key;
}

interface YAMLLine {
    readonly key: string;
    readonly value?: string;
}

interface YAMLValueInContext {
    readonly key: string;
    readonly value: string;
    readonly parentKey?: string;
    readonly kind: string;
}