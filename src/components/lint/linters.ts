import * as vscode from 'vscode';

import { ResourceLimitsLinter } from './resourcelimits';

export interface Linter {
    lint(document: vscode.TextDocument): Promise<vscode.Diagnostic[]>;
}

export const linters: Linter[] = [
    new ResourceLimitsLinter()
];
