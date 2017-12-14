import * as vscode from 'vscode';
import { FuncMap } from './helm.funcmap';
import * as logger from './logger';
import * as YAML from 'yamljs';
import * as exec from './helm.exec';
import * as path from 'path';
import * as _ from 'lodash';
import {existsSync} from 'fs';

export class HelmTemplateCompletionProvider implements vscode.CompletionItemProvider {
    
    private valuesMatcher = new RegExp('\\s+\\.Values\\.([a-zA-Z0-9\\._-]+)?$');
    private funcmap = new FuncMap();

    // TODO: On focus, rebuild the values.yaml cache
    private valuesCache;

    public constructor() {
        this.refreshValues();
    }

    public refreshValues() {
        let ed = vscode.window.activeTextEditor;
        if (!ed) {
            return;
        }

        let self = this;
        exec.pickChartForFile(ed.document.fileName, (f) => {
            let valsYaml = path.join(f, "values.yaml");
            if (!existsSync(valsYaml)) {
                return;
            }
            try {
                self.valuesCache = YAML.load(valsYaml);
            } catch (err) {
                logger.helm.log(err.message);
                return;
            }
        });
    }

    public provideCompletionItems(doc: vscode.TextDocument, pos: vscode.Position) {

        // If the preceding character is a '.', we kick it into dot resolution mode.
        // Otherwise, we go with function completion.
        const wordPos = doc.getWordRangeAtPosition(pos);
        const word = doc.getText(wordPos);
        const line = doc.lineAt(pos.line).text;
        const lineUntil = line.substr(0, wordPos.start.character);

        //logger.log(lineUntil)
        if (lineUntil.endsWith(".")) {
            //logger.log("sending to dotCompletionItems ")
            return this.dotCompletionItems(doc, pos, word, lineUntil);
        }

        return new vscode.CompletionList((new FuncMap).all());
    }

    dotCompletionItems(doc: vscode.TextDocument, pos: vscode.Position, word: string, lineUntil: string): vscode.CompletionItem[] {
        if (lineUntil.endsWith(" .")) {
            return this.funcmap.helmVals();
        } else if (lineUntil.endsWith(".Release.")) {
            return this.funcmap.releaseVals();
        } else if (lineUntil.endsWith(".Chart.")) {
            return this.funcmap.chartVals();
        } else if (lineUntil.endsWith(".Files.")) {
            return this.funcmap.filesVals();
        } else if (lineUntil.endsWith(".Capabilities.")) {
            return this.funcmap.capabilitiesVals();
        } else if (lineUntil.endsWith(".Values.")) {
            if (!_.isPlainObject(this.valuesCache)) {
                return;
            }
            let keys = _.keys(this.valuesCache);
            let res = [];
            keys.forEach((key) => {
                res.push(this.funcmap.v(key, ".Values."+key, "In values.yaml: " + this.valuesCache[key]));
            });
            return res;

        } else {
            // If we get here, we inspect the string to see if we are at some point in a
            // .Values.SOMETHING. expansion. We recurse through the values file to see
            // if there are any autocomplete options there.
            let res;
            try {
                res = this.valuesMatcher.exec(lineUntil);
            } catch (err) {
                logger.helm.log(err.message);
                return [];
            }
            
            // If this does not match the valuesMatcher (Not a .Values.SOMETHING...) then
            // we return right away.
            if (!res || res.length == 0) {
                return [];
            }
            //logger.log("Match: " + res[0] + " ('"+res[1]+"' matches)")
            if (res[1].length == 0 ) {
                // This is probably impossible. It would match '.Values.', but that is
                // matched by a previous condition.
                return [];
            }

            // If we get here, we've got .Values.SOMETHING..., and we want to walk that
            // tree to see what suggestions we can give based on the contents of the
            // current values.yaml file.
            const parts = res[1].split(".");
            let words = [];
            let cache = this.valuesCache;
            for (const cur of parts) {
                if (cur.length == 0) {
                    // We hit the trailing dot.
                    break;
                }
                if (!cache[cur]) {
                    // The key does not exist. User has typed something not in values.yaml
                    return [];
                }
                cache = cache[cur];
            }
            if (!cache) {
                //logger.log("Found no matches for " + res[1])
                return [];
            }
            let k = [];
            _.keys(cache).forEach((item) => {
                // Build help text for each suggestion we found.
                k.push(this.v(item, res[0] + item, "In values.yaml: " + cache[item]));
            });
            return k;
        }
    }
    v(name: string, use: string, doc: string): vscode.CompletionItem {
        let i = new vscode.CompletionItem(name, vscode.CompletionItemKind.Constant);
        i.detail = use;
        i.documentation = doc;
        return i;
    }
/*
    f(name: string, args: string, doc: string): vscode.CompletionItem {
        let i = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
        i.detail = args;
        i.documentation = doc;
        return i;
    }
    withValues(fn) {
        let doc = vscode.window.activeTextEditor.document;
        exec.pickChartForFile(doc.fileName, (f) => {
            let valsYaml = path.join(f, "values.yaml");
            let vals;
            try {
                vals = YAML.load(valsYaml);
            } catch (err) {
                logger.helm.log(err.message);
                fn({});
            }
            fn(vals);
        });
    }
    */
}