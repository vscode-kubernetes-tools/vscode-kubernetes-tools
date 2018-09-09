import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

import { JsonALikeYamlDocumentSymbolProvider } from '../../yaml-support/jsonalike-symbol-provider';
import { Linter } from './linters';

const jsonalikeYamlSymboliser = new JsonALikeYamlDocumentSymbolProvider();

export function expose(impl: LinterImpl): Linter {
    return new StandardLinter(impl);
}

export interface Syntax {
    load(text: string): any[];
    symbolise(document: vscode.TextDocument): Promise<vscode.SymbolInformation[]>;
}

class StandardLinter implements Linter {
    constructor(private readonly impl: LinterImpl) {}

    async lint(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        try {
            switch (document.languageId) {
                case 'json':
                    return await this.impl.lint(document, jsonSyntax);
                case 'yaml':
                    return await this.impl.lint(document, yamlSyntax);
                default:
                    // TODO: do we need to do Helm?
                    return [];
            }
        } catch {
            return [];
        }
    }
}

const jsonSyntax = {
    load(text: string) { return [JSON.parse(text)]; },
    symbolise(document: vscode.TextDocument) { return getSymbols(document); }
};

const yamlSyntax = {
    load(text: string) { return yaml.safeLoadAll(text); },
    async symbolise(document: vscode.TextDocument) { return await jsonalikeYamlSymboliser.provideDocumentSymbols(document, new vscode.CancellationTokenSource().token); }
};

export interface LinterImpl {
    lint(document: vscode.TextDocument, syntax: Syntax): Promise<vscode.Diagnostic[]>;
}

async function getSymbols(document: vscode.TextDocument): Promise<vscode.SymbolInformation[]> {
    const sis: any = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);

    if (sis && sis.length) {
        return sis;
    }

    return [];
}
