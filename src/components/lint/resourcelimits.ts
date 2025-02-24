import * as vscode from 'vscode';

import { LinterImpl, Syntax } from './linter.impl';
import { warningOn, childSymbols } from './linter.utils';
import { flatten } from '../../utils/array';

// Pod->spec (which can also be found as Deployment->spec.template.spec)
// .containers[each].resources.limits.{cpu,memory}

export class ResourceLimitsLinter implements LinterImpl {
    name(): string {
        return "resource-limits";
    }

    async lint(document: vscode.TextDocument, syntax: Syntax): Promise<vscode.Diagnostic[]> {
        const resources = syntax.load(document.getText());
        if (!resources) {
            return [];
        }

        const symbols = await syntax.symbolise(document);
        if (!symbols) {
            return [];
        }

        const diagnostics = resources.map((r) => this.lintOne(r, symbols));
        return flatten(...diagnostics);
    }

    private lintOne(resource: any, symbols: vscode.SymbolInformation[]): vscode.Diagnostic[] {
        if (!resource) {
            return [];
        }

        const podSpecPrefix =
            resource.kind === 'Pod' ? 'spec' :
            resource.kind === 'Deployment' ? 'spec.template.spec' :
            undefined;
        if (!podSpecPrefix) {
            return [];
        }

        const containersSymbols = symbols.filter((s) => s.name === 'containers' && s.containerName === podSpecPrefix);
        if (!containersSymbols) {
            return [];
        }

        const warnings: vscode.Diagnostic[] = [];
        const warnOn = (symbol: vscode.SymbolInformation, text: string) => {
            warnings.push(warningOn(symbol, text));
        };

        for (const containersSymbol of containersSymbols) {
            const imagesSymbols = childSymbols(symbols, containersSymbol, 'image');
            const resourcesSymbols = childSymbols(symbols, containersSymbol, 'resources');
            if (resourcesSymbols.length < imagesSymbols.length) {
                warnOn(containersSymbol, 'One or more containers do not have resource limits - this could starve other processes');
            }
            for (const resourcesSymbol of resourcesSymbols) {
                const limitsSymbols = childSymbols(symbols, resourcesSymbol, 'limits');
                if (limitsSymbols.length === 0) {
                    warnOn(resourcesSymbol, 'No resource limits specified for this container - this could starve other processes');
                }
                for (const limitsSymbol of limitsSymbols) {
                    const memorySymbols = childSymbols(symbols, limitsSymbol, 'memory');
                    if (memorySymbols.length === 0) {
                        warnOn(limitsSymbol, 'No memory limit specified for this container - this could starve other processes');
                    }
                }
            }
        }

        return warnings;
    }
}
