import * as vscode from 'vscode';

import { expose } from './linter.impl';
import { ResourceLimitsLinter } from './resourcelimits';

export interface Linter {
    name(): string;
    lint(document: vscode.TextDocument): Promise<vscode.Diagnostic[]>;
}

export const linters: Linter[] = [
    new ResourceLimitsLinter()
].map(expose);
