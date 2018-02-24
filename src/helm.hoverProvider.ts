import * as vscode from 'vscode';
import { FuncMap } from './helm.funcmap';
import { Resources } from './helm.resources';

import { yamlLocator, yamlUtil } from './yaml-language-support/yaml-support';

// Provide hover support
export class HelmTemplateHoverProvider implements vscode.HoverProvider {
    private funcmap;
    private valmap;
    private resmap;

    public constructor() {
        let fm = new FuncMap();
        let rs = new Resources();
        this.funcmap = fm.all();
        this.valmap = fm.helmVals();
        this.resmap = rs.all();
    }

    public provideHover(doc: vscode.TextDocument, pos: vscode.Position, tok: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        let wordRange = doc.getWordRangeAtPosition(pos);
        let word = wordRange ? doc.getText(wordRange) : "";
        if (word == "") {
            return Promise.resolve(null);
        }

        // FIXME: right now, the line `foo: {{foo}}` may match both the action and the resource def

        if (this.inActionVal(doc, pos, word)) {
            let found = this.findVal(word);
            if (found) {
                return new vscode.Hover(found, wordRange);
            }
        }

        if (this.inAction(doc, pos, word)) {
            let found = this.findFunc(word);
            if (found) {
               return new vscode.Hover(found, wordRange);
            }
        }

        if (this.notInAction(doc, pos, word)) {
            try {
                // have a test against whether the word is a key element in yaml
                const { matchedNode } = yamlLocator.getYamlElement(doc, pos);
                if (!yamlUtil.isKey(matchedNode)) {
                    return Promise.resolve(null);
                }
            } catch (ex) {
                console.log(ex);
            }
            let found = this.findResourceDef(word);
            if (found) {
                return new vscode.Hover(found, wordRange);
            }
        }
        return Promise.resolve(null);
    }

    private inAction(doc: vscode.TextDocument, pos: vscode.Position, word: string): boolean {
        let lineText = doc.lineAt(pos.line).text;
        let r = new RegExp("{{[^}]*[\\s\\(|]?("+word+")\\s[^{]*}}");
        return r.test(lineText);
    }

    private notInAction(doc: vscode.TextDocument, pos: vscode.Position, word: string): boolean {
        let lineText = doc.lineAt(pos.line).text;
        let r = new RegExp("(^|})[^{]*("+word+")");
        return r.test(lineText);
    }

    private findFunc(word: string): vscode.MarkedString[] | string{
        for (const item of this.funcmap) {
            if (item.label == word) {
                return [{language: "helm", value:`{{ ${ item.detail } }}`}, `${ item.documentation }`];
            }
        }
    }

    private inActionVal(doc: vscode.TextDocument, pos: vscode.Position, word: string): boolean {
        let lineText = doc.lineAt(pos.line).text;
        let r = new RegExp("{{[^}]*\\.("+word+")[\\.\\s]?[^{]*}}");
        return r.test(lineText);
    }

    private findVal(word: string): vscode.MarkedString[] | string{
        for (const item of this.valmap) {
            if (item.label == word) {
                return [{language: "helm", value:`{{ ${ item.detail } }}`}, `${ item.documentation }`];
            }
        }
    }
    private findResourceDef(word: string): vscode.MarkedString[] | string {
        for (const item of this.resmap) {
            if (item.label == word) {
                return [{language: "helm", value:`${ item.detail }`}, `${ item.documentation }`];
            }
        }
    }
}
