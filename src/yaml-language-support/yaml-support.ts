import * as vscode from 'vscode';

import { parse, findNodeAtPosition, util as yamlUtil } from 'node-yaml-parser';

export interface YamlCache {
    // the document model list represents the yaml text
    yamlDocs: any[];

    // lineLens contains the converted line length of each lines, it is used for converting from
    // vscode position to the inner position in yaml element model.
    lineLens: number[];

    // the version of the document to avoid duplicate work on the same text
    version: number;
}

export interface YamlMatchedElement {
    // the document model list represents the yaml text
    readonly yamlDocs: any[];

    // the found node at the given position(usually at the edit/hover place)
    readonly matchedNode: any;

    // the document which contains the node at given position
    readonly matchedDocument: any;
}

/**
 * A yaml interpreter parse the yaml text and find the matched ast node from vscode location.
 */
 class YamlLocator {
    
    private _cache:{ [key:string]: YamlCache; }  = {};

    /**
     * Parse the yaml text and find the best node&document for the given position.
     *
     * @param {vscode.TextDocument} textDocument vscode text document
     * @param {vscode.Position} pos vscode position
     * @returns {YamlMatchedElement} the search results of yaml elements at the given position
     */
    public getYamlElement(textDocument: vscode.TextDocument, pos: vscode.Position): YamlMatchedElement {
        const key: string = textDocument.uri.toString();
        if (!this._cache[key]) {
            this._cache[key] = <YamlCache> {version: -1};
        }

        if (this._cache[key].version !== textDocument.version) {
            const { documents, lineLens } = parse(textDocument.getText());
            this._cache[key].yamlDocs = documents;
            this._cache[key].lineLens = lineLens;
            this._cache[key].version = textDocument.version;
        }

        const cache = this._cache[key];
        return {
            yamlDocs: cache.yamlDocs,
            ...findNodeAtPosition(cache.yamlDocs, cache.lineLens, pos.line, pos.character)
        };
    }

 }

 // a global instance of yaml locator
const yamlLocator = new YamlLocator();

 // yamlUtil contains the important util functions for handling with yaml elements
export { yamlLocator, yamlUtil };