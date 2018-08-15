import * as vscode from 'vscode';

export function symbolContains(outer: vscode.SymbolInformation, inner: vscode.SymbolInformation): boolean {
    return outer.location.range.contains(inner.location.range);  // don't worry about URI
}

export function childSymbols(allSymbols: vscode.SymbolInformation[], parent: vscode.SymbolInformation, name: string): vscode.SymbolInformation[] {
    return allSymbols.filter((s) => s.name === name && s.containerName === `${parent.containerName}.${parent.name}` && symbolContains(parent, s));
}

export function warningOn(symbol: vscode.SymbolInformation, text: string): vscode.Diagnostic {
    return new vscode.Diagnostic(symbol.location.range, text, vscode.DiagnosticSeverity.Warning);
}
