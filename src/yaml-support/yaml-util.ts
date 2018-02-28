import * as vscode from 'vscode';
import { yamlLocator } from './yaml-locator';
import { util as yamlUtil } from 'node-yaml-parser';

/**
 * Test whether the current position is at any key in yaml file.
 *
 * @param {vscode.TextDocument} doc the yaml text document
 * @param {vscode.Position} pos the position
 * @returns {boolean} whether the current position is at any key
 */
export function isPositionInKey(doc: vscode.TextDocument, pos: vscode.Position): boolean {
    if (!doc || !pos) {
        return false;
    }

    const { matchedNode } = yamlLocator.getMatchedElement(doc, pos);
    return yamlUtil.isKey(matchedNode);
}