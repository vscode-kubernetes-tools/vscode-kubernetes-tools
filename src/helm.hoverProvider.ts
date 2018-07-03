import * as vscode from 'vscode';
import { FuncMap } from './helm.funcmap';
import { Resources } from './helm.resources';
import { isPositionInKey } from "./yaml-support/yaml-util";

// Provide hover support
export class HelmTemplateHoverProvider implements vscode.HoverProvider {
    private funcmap;
    private valmap;
    private resmap;

    public constructor() {
        const fm = new FuncMap();
        const rs = new Resources();
        this.funcmap = fm.all();
        this.valmap = fm.helmVals();
        this.resmap = rs.all();
    }

    public provideHover(doc: vscode.TextDocument, pos: vscode.Position, tok: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        const wordRange = doc.getWordRangeAtPosition(pos);
        const word = wordRange ? doc.getText(wordRange) : "";
        if (word === "") {
            return Promise.resolve(null);
        }

        if (this.inActionVal(doc, pos, word)) {
            const found = this.findVal(word);
            if (found) {
                return new vscode.Hover(found, wordRange);
            }
        }

        if (this.inAction(doc, pos, word)) {
            const found = this.findFunc(word);
            if (found) {
               return new vscode.Hover(found, wordRange);
            }
        }

        if (this.notInAction(doc, pos, word)) {
            try {
                // when the word is in value position, it should not pop up hovers, for example,
                // the following yaml should not show pop up window for 'metadata'
                // selector:
                //  app: metadata

                if (!isPositionInKey(doc, pos)) {
                    return;
                }
            } catch (ex) {
                // ignore since the editing yaml may not be able to parse
            }
            const found = this.findResourceDef(word);
            if (found) {
                return new vscode.Hover(found, wordRange);
            }
        }
        return Promise.resolve(null);
    }

    private inAction(doc: vscode.TextDocument, pos: vscode.Position, word: string): boolean {
        const lineText = doc.lineAt(pos.line).text;
        const r = new RegExp(`{{[^}]*[\\s\\(|]?(${word})\\s[^{]*}}`);
        return r.test(lineText);
    }

    private notInAction(doc: vscode.TextDocument, pos: vscode.Position, word: string): boolean {
        const lineText = doc.lineAt(pos.line).text;
        const r = new RegExp(`(^|})[^{]*(${word})`);
        return r.test(lineText);
    }

    private findFunc(word: string): vscode.MarkedString[] | string {
        for (const item of this.funcmap) {
            if (item.label === word) {
                return [{language: "helm", value: `{{ ${ item.detail } }}`}, `${ item.documentation }`];
            }
        }
    }

    private inActionVal(doc: vscode.TextDocument, pos: vscode.Position, word: string): boolean {
        const lineText = doc.lineAt(pos.line).text;
        const r = new RegExp(`{{[^}]*\\.(${word})[\\.\\s]?[^{]*}}`);
        return r.test(lineText);
    }

    private findVal(word: string): vscode.MarkedString[] | string {
        for (const item of this.valmap) {
            if (item.label === word) {
                return [{language: "helm", value: `{{ ${ item.detail } }}`}, `${ item.documentation }`];
            }
        }
    }
    private findResourceDef(word: string): vscode.MarkedString[] | string {
        for (const item of this.resmap) {
            if (item.label === word) {
                return [{language: "helm", value: `${ item.detail }`}, `${ item.documentation }`];
            }
        }
    }
}
