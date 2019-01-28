import * as vscode from 'vscode';

export class JsonHierarchicalDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    provideDocumentSymbols(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation[]> {
        return this.provideDocumentSymbolsImpl(document);
    }

    async provideDocumentSymbolsImpl(document: vscode.TextDocument): Promise<vscode.SymbolInformation[]> {
        const sis: any = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);

        if (sis && sis.length) {
            const hnSymbols = hierarchicalContainers(sis);
            return hnSymbols;
        }

        return [];
    }
}

function hierarchicalContainers(symbols: vscode.SymbolInformation[]): vscode.SymbolInformation[] {
    return symbols.map((symbol) => {
        const containingSymbols = symbols.filter((s) => contains(s, symbol));
        const hierarchisedContainerName = makeHierarchicalContainerName(symbol, containingSymbols);
        const s = new vscode.SymbolInformation(symbol.name, symbol.kind, hierarchisedContainerName, symbol.location);
        return s;
    });
}

function contains(s: vscode.SymbolInformation, symbol: vscode.SymbolInformation): boolean {
    return (s !== symbol) && s.location.range.contains(symbol.location.range);
}

function makeHierarchicalContainerName(symbol: vscode.SymbolInformation, symbols: vscode.SymbolInformation[]): string {
    if (!symbol.containerName) {
        return '';
    }
    const immediateContainer = findImmediateContainer(symbol, symbols);
    if (!immediateContainer) {
        return symbol.containerName;
    }
    const immediateContainerHN = makeHierarchicalContainerName(immediateContainer, symbols.filter((s) => contains(s, immediateContainer)));
    if (immediateContainerHN === '') {
        return symbol.containerName;
    }
    if (symbol.containerName === '0') {
        return immediateContainerHN;
    }
    return `${immediateContainerHN}.${symbol.containerName}`;
}

function findImmediateContainer(symbol: vscode.SymbolInformation, symbols: vscode.SymbolInformation[]): vscode.SymbolInformation | undefined {
    const candidates = symbols.filter((s) => s.name === symbol.containerName);
    if (candidates.length === 1) {
        return candidates[0];
    }
    if (candidates.length === 0) {
        return undefined;
    }
    return mostContained(candidates);
}

function mostContained(symbols: vscode.SymbolInformation[]): vscode.SymbolInformation | undefined {
    let candidate = symbols[0];
    for (const s of symbols) {
        if (contains(candidate, s)) {
            candidate = s;
        }
    }
    return candidate;
}
