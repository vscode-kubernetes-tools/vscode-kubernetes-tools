import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

import { Linter } from './linters';
import { JsonALikeYamlDocumentSymbolProvider } from '../../yaml-support/jsonalike-symbol-provider';

const jsonalikeYamlSymboliser = new JsonALikeYamlDocumentSymbolProvider();

interface Syntax {
    load(text: string): any;
    symbolise(document: vscode.TextDocument): Promise<vscode.SymbolInformation[]>;
}

const jsonSyntax = {
    load(text: string) { return JSON.parse(text); },
    symbolise(document: vscode.TextDocument) { return getSymbols(document); }
};

const yamlSyntax = {
    load(text: string) { return yaml.safeLoad(text); },
    async symbolise(document: vscode.TextDocument) { return await jsonalikeYamlSymboliser.provideDocumentSymbols(document, new vscode.CancellationTokenSource().token); }
};

// Pod->spec (which can also be found as Deployment->spec.template.spec)
// .containers[each].resources.limits.{cpu,memory}

export class ResourceLimitsLinter implements Linter {
    async lint(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        try {
            switch (document.languageId) {
                case 'json':
                    return await this.lintCore(document, jsonSyntax);
                case 'yaml':
                    return await this.lintCore(document, yamlSyntax);
                default:
                    // TODO: do we need to do Helm?
                    return [];
            }
        } catch {
            return [];
        }
    }

    async lintCore(document: vscode.TextDocument, syntax: Syntax): Promise<vscode.Diagnostic[]> {
        const resource = syntax.load(document.getText());
        if (!resource) {
            return [];
        }

        const podSpecPrefix =
            resource.kind === 'Pod' ? 'spec' :
            resource.kind === 'Deployment' ? 'spec.template.spec' :
            undefined;
        if (!podSpecPrefix) {
            return [];
        }

        const symbols = await syntax.symbolise(document);
        const containersSymbols = symbols.filter((s) => s.name === 'containers' && s.containerName === podSpecPrefix);
        if (!containersSymbols) {
            return [];
        }

        const warnings: vscode.Diagnostic[] = [];
        const warnOn = (symbol: vscode.SymbolInformation, text: string) => {
            warnings.push(warningOn(symbol, text));
        };

        for (const containersSymbol of containersSymbols) {
            const imagesSymbols = childSymbols(symbols, containersSymbol, 'image');
            const resourcesSymbols = childSymbols(symbols, containersSymbol, 'resources');
            if (resourcesSymbols.length < imagesSymbols.length) {
                warnOn(containersSymbol, 'One or more containers do not have resource limits - this could starve other processes');
            }
            for (const resourcesSymbol of resourcesSymbols) {
                const limitsSymbols = childSymbols(symbols, resourcesSymbol, 'limits');
                if (limitsSymbols.length === 0) {
                    warnOn(resourcesSymbol, 'No resource limits specified for this container - this could starve other processes');
                }
                for (const limitsSymbol of limitsSymbols) {
                    const cpuSymbols = childSymbols(symbols, limitsSymbol, 'cpu');
                    if (cpuSymbols.length === 0) {
                        warnOn(limitsSymbol, 'No CPU limit specified for this container - this could starve other processes');
                    }
                    const memorySymbols = childSymbols(symbols, limitsSymbol, 'memory');
                    if (memorySymbols.length === 0) {
                        warnOn(limitsSymbol, 'No memory limit specified for this container - this could starve other processes');
                    }
                }
            }
        }

        return warnings;
    }
}

async function getSymbols(document: vscode.TextDocument): Promise<vscode.SymbolInformation[]> {
    const sis: any = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);

    if (sis && sis.length) {
        return sis;
    }

    return [];
}

function symbolContains(outer: vscode.SymbolInformation, inner: vscode.SymbolInformation): boolean {
    return outer.location.range.contains(inner.location.range);  // don't worry about URI
}

function childSymbols(allSymbols: vscode.SymbolInformation[], parent: vscode.SymbolInformation, name: string): vscode.SymbolInformation[] {
    return allSymbols.filter((s) => s.name === name && s.containerName === `${parent.containerName}.${parent.name}` && symbolContains(parent, s));
}

function warningOn(symbol: vscode.SymbolInformation, text: string): vscode.Diagnostic {
    return new vscode.Diagnostic(symbol.location.range, text, vscode.DiagnosticSeverity.Warning);
}
