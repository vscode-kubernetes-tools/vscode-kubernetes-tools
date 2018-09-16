import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

import { JsonALikeYamlDocumentSymbolProvider } from '../../yaml-support/jsonalike-symbol-provider';
import { Linter } from './linters';
import { JsonHierarchicalDocumentSymbolProvider } from '../json/jsonhierarchicalsymbolprovider';

const jsonalikeYamlSymboliser = new JsonALikeYamlDocumentSymbolProvider();
const jsonSymboliser = new JsonHierarchicalDocumentSymbolProvider();

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
    async symbolise(document: vscode.TextDocument) { return await jsonSymboliser.provideDocumentSymbols(document, new vscode.CancellationTokenSource().token); }
};

const yamlSyntax = {
    load(text: string) { return yaml.safeLoadAll(text); },
    async symbolise(document: vscode.TextDocument) { return await jsonalikeYamlSymboliser.provideDocumentSymbols(document, new vscode.CancellationTokenSource().token); }
};

export interface LinterImpl {
    lint(document: vscode.TextDocument, syntax: Syntax): Promise<vscode.Diagnostic[]>;
}
