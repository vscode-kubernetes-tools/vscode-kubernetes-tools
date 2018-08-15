import * as vscode from 'vscode';

export function findParentYaml(document: vscode.TextDocument, line: number): number {
    const indent = yamlIndentLevel(document.lineAt(line).text);
    while (line >= 0) {
        const txt = document.lineAt(line);
        if (yamlIndentLevel(txt.text) < indent) {
            return line;
        }
        line = line - 1;
    }
    return line;
}

function yamlIndentLevel(str: string): number {
    let i = 0;

    while (true) {
        if (str.length <= i || !isYamlIndentChar(str.charAt(i))) {
            return i;
        }
        ++i;
    }
}

function isYamlIndentChar(ch: string): boolean {
    return ch === ' ' || ch === '-';
}
