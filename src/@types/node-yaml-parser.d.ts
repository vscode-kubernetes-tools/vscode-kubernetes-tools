declare module 'node-yaml-parser' {
    export function parse(text: string): { readonly documents: YamlDocument[]; readonly lineLengths: number[] };
    export function findNodeAtPosition(documents: YamlDocument[], lineLengths: number[], line: number, char: number): YamlMatchedElement;

    export interface YamlNode {
        readonly kind: string;
        readonly raw: string;
        readonly startPosition: number;
        readonly endPosition: number;
        readonly parent?: YamlNode;
    }

    export interface YamlDocument {
        readonly nodes: YamlNode[];
        readonly errors: string[];
    }

    export interface YamlMatchedElement {
        readonly matchedNode: YamlNode;
        readonly matchedDocument: YamlDocument;
    }
}
