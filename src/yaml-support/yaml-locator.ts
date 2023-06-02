import * as vscode from 'vscode';

import { parse, findNodeAtPosition } from 'node-yaml-parser';
import YAML = require('yamljs');

export function isMapping(node: YamlNode): node is YamlMap {
    return node.kind === 'MAPPING';
}

export function isSequence(node: YamlNode): node is YamlSequence {
    return node.kind === 'SEQ';
}

export function isMappingItem(node: YamlNode): node is YamlMappingItem {
    return node.kind === 'PAIR';
}

export interface YamlNode {
    readonly kind: string;
    readonly raw: string;
    readonly startPosition: number;
    readonly endPosition: number;
    readonly parent?: YamlNode;
}

export interface YamlMappingItem extends YamlNode {
    readonly key: YamlNode;
    readonly value: YamlNode;
}

export interface YamlMap extends YamlNode {
    readonly mappings: YamlMappingItem[];
}

export interface YamlSequence extends YamlNode {
    readonly items: YamlNode[];
}

export interface YamlDocument {
    readonly nodes: YamlNode[];
    readonly errors: string[];
}

export interface YamlCachedDocuments {
    // the documents represents the yaml text
    yamlDocs: YamlDocument[];

    // lineLengths contains the converted line length of each lines, it is used for converting from
    // vscode position to the inner position in yaml element model.
    lineLengths: number[];

    // the version of the document to avoid duplicate work on the same text
    version: number;
}

export interface YamlMatchedElement {
    // the found node at the given position(usually at the edit/hover place)
    readonly matchedNode: YamlNode;

    // the document which contains the node at given position
    readonly matchedDocument: YamlDocument;
}

/**
 * A yaml interpreter parse the yaml text and find the matched ast node from vscode location.
 */
export class YamlLocator {
    // a mapping of URIs to cached documents
    private cache: { [key: string]: YamlCachedDocuments }  = {};

    /**
     * Parse the yaml text and find the best node&document for the given position.
     *
     * @param {vscode.TextDocument} textDocument vscode text document
     * @param {vscode.Position} pos vscode position
     * @returns {YamlMatchedElement} the search results of yaml elements at the given position
     */
    public getMatchedElement(textDocument: vscode.TextDocument, pos: vscode.Position): YamlMatchedElement | undefined {
        const key: string = textDocument.uri.toString();
        this.ensureCache(key, textDocument);
        const cacheEntry = this.cache[key];
        if (!cacheEntry) {
            return undefined;
        }
        // findNodeAtPosition will find the matched node at given position
        return findNodeAtPosition(cacheEntry.yamlDocs, cacheEntry.lineLengths, pos.line, pos.character);
    }

    /**
     * Parse the yaml text and find the best node&document for the given position.
     *
     * @param {vscode.TextDocument} textDocument vscode text document
     * @param {vscode.Position} pos vscode position
     * @returns {YamlMatchedElement} the search results of yaml elements at the given position
     */
    public getYamlDocuments(textDocument: vscode.TextDocument): YamlDocument[] {
        const key: string = textDocument.uri.toString();
        this.ensureCache(key, textDocument);
        if (!this.cache[key]) {
            return [];
        }
        return this.cache[key].yamlDocs ? this.cache[key].yamlDocs : [];
    }

    private ensureCache(key: string, textDocument: vscode.TextDocument): void {
        if (!this.cache[key]) {
            this.cache[key] = <YamlCachedDocuments> { version: -1 };
        }

        if (this.cache[key].version !== textDocument.version) {
            // the document and line lengths from parse method is cached into YamlCachedDocuments to avoid duplicate
            // parse against the same text.
            try {
                YAML.parse(textDocument.getText()); // this is used to detect errors in the yaml file before actually parse it with the node-yaml-parser lib
                const { documents, lineLengths } = parse(textDocument.getText());
                this.cache[key].yamlDocs = documents;
                this.cache[key].lineLengths = lineLengths;
                this.cache[key].version = textDocument.version;
            } catch (err) {
                delete this.cache[key];
            }
        }
    }
}

// a global instance of yaml locator
const yamlLocator = new YamlLocator();

export { yamlLocator };
