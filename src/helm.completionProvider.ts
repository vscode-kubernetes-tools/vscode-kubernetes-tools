import * as vscode from 'vscode';
import { FuncMap } from './helm.funcmap';
import * as logger from './logger';
import * as YAML from 'yamljs';
import * as exec from './helm.exec';
import * as path from 'path';
import * as _ from 'lodash';
import { existsSync } from 'fs';

export class HelmTemplateCompletionProvider implements vscode.CompletionItemProvider {

    private valuesMatcher = new RegExp('\\s+\\.Values\\.([a-zA-Z0-9\\._-]+)?$');
    private funcmap = new FuncMap();

    private valuesCache: any;  // pulled in from YAML, no schema
    private valuesWatcher: vscode.FileSystemWatcher;

    public constructor() {
        // The extension activates on things like 'Kubernetes tree visible',
        // which can occur on any project (not just projects containing k8s
        // manifests or Helm charts). So we don't want the mere initialisation
        // of the completion provider to trigger an error message if there are
        // no charts - this will actually be the *probable* case.
        this.initializeValues({ warnIfNoCharts: false });
    }

    public initializeValues(options: exec.PickChartUIOptions) {
        const ed = vscode.window.activeTextEditor;
        if (!ed) {
            return;
        }

        exec.pickChartForFile(ed.document.fileName, options, (f) => {
            const valsYaml = path.join(f, "values.yaml");
            if (!existsSync(valsYaml)) {
                return;
            }
            this.refreshValues(valsYaml);
            this.valuesWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(f, "values.yaml"));
            this.valuesWatcher.onDidChange((uri) => this.refreshValues(uri.fsPath));
        });
    }

    private refreshValues(valsYaml: string) {
        try {
            this.valuesCache = YAML.load(valsYaml);
        } catch (err) {
            logger.helm.log(err.message);
            return;
        }
    }

    public provideCompletionItems(doc: vscode.TextDocument, pos: vscode.Position): vscode.CompletionList | vscode.CompletionItem[] {
        // If the preceding character is a '.', we kick it into dot resolution mode.
        // Otherwise, we go with function completion.
        const line = doc.lineAt(pos.line).text;
        const wordPos = doc.getWordRangeAtPosition(pos);
        let lineUntil = line.substr(0, pos.character);
        if (wordPos) {
            lineUntil = line.substr(0, wordPos.start.character);
        }

        if (lineUntil.endsWith(".")) {
            return this.dotCompletionItems(lineUntil);
        }

        return new vscode.CompletionList((new FuncMap).all());
    }

    dotCompletionItems(lineUntil: string): vscode.CompletionItem[] {
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
                return [];
            }
            const keys = _.keys(this.valuesCache);
            const res = keys.map((key) =>
                this.funcmap.v(key, ".Values."+key, "In values.yaml: " + this.valuesCache[key])
            );
            return res;

        } else {
            // If we get here, we inspect the string to see if we are at some point in a
            // .Values.SOMETHING. expansion. We recurse through the values file to see
            // if there are any autocomplete options there.
            let reExecResult: RegExpExecArray | null = null;
            try {
                reExecResult = this.valuesMatcher.exec(lineUntil);
            } catch (err) {
                logger.helm.log(err.message);
                return [];
            }

            // If this does not match the valuesMatcher (Not a .Values.SOMETHING...) then
            // we return right away.
            if (!reExecResult || reExecResult.length === 0) {
                return [];
            }
            if (reExecResult[1].length === 0 ) {
                // This is probably impossible. It would match '.Values.', but that is
                // matched by a previous condition.
                return [];
            }

            const valuesMatches = reExecResult;  // for type inference

            // If we get here, we've got .Values.SOMETHING..., and we want to walk that
            // tree to see what suggestions we can give based on the contents of the
            // current values.yaml file.
            const parts = reExecResult[1].split(".");
            let cache = this.valuesCache;
            for (const cur of parts) {
                if (cur.length === 0) {
                    // We hit the trailing dot.
                    break;
                }
                if (!cache[cur]) {
                    // The key does not exist. User has typed something not in values.yaml
                    return [];
                }
                cache = cache[cur];
            }
            if (!cache || typeof cache === "string" || cache.constructor.name === 'Array') {
                return [];
            }
            const k = _.keys(cache).map((item) =>
                // Build help text for each suggestion we found.
                this.v(item, valuesMatches[0] + item, "In values.yaml: " + cache[item])
            );
            return k;
        }
    }

    v(name: string, use: string, doc: string): vscode.CompletionItem {
        const i = new vscode.CompletionItem(name, vscode.CompletionItemKind.Constant);
        i.detail = use;
        i.documentation = doc;
        return i;
    }
}
