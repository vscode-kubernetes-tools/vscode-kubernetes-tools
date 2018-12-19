import * as vscode from 'vscode';
import * as v1 from './v1';
import * as _ from 'lodash';
import * as fs from './wsl-fs';
import * as filepath from 'path';
import { shell } from './shell';

// Resources describes Kubernetes resource keywords.
export class Resources {
    public all(): vscode.CompletionItem[] {
        const home = shell.home();
        const schemaDir = filepath.join(home, ".kube/schema");
        const stat = fs.statSync(schemaDir);
        if (!stat.isDirectory()) {
            // Return the default set.
            return this.v1();
        }
        // Otherwise, try to dynamically build completion items from the
        // entire schema.
        const kversion = _.last(shell.ls(schemaDir));
        console.log("Loading schema for version " + kversion);

        // Inside of the schemaDir, there are some top-level copies of the schemata.
        // Instead of walking the tree, we just parse those.  Note that kubectl loads
        // schemata on demand, which means we won't have an exhaustive list, but we are
        // more likely to get the ones that this user is actually using, including
        // TPRs.
        let res = [];
        const path = filepath.join(schemaDir, kversion);
        shell.ls(path).forEach((item) => {
            const itemPath = filepath.join(path, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
                return;
            }
            const schema = JSON.parse(shell.cat(itemPath));
            if (!schema.models) {
                return;
            }
            console.log("Adding schema " + itemPath);
            res = res.concat(this.fromSchema(schema.models));
        });
        console.log(`Attached ${res.length} resource kinds`);
        return res;
    }

    v1(): vscode.CompletionItem[] {
        return this.fromSchema(v1.default.models);
    }

    // Extract hover documentation from a Swagger model.
    fromSchema(schema): vscode.CompletionItem[] {
        const res = [];
        _.each(schema, (v, k) => {
            const i = k.lastIndexOf(".");
            const kind = k.substr(i+1);
            res.push(val(kind, `kind: ${ kind }`, v.description));
            _.each(v.properties, (spec, label) => {
                let type = "undefined";
                switch (spec.type) {
                    case undefined:
                        // This usually means there's a $ref instead of a type
                        if (spec["$ref"]) {
                            type = spec["$ref"];
                        }
                        break;
                    case "array":
                        // Try to give a pretty type.
                        if (spec.items.type) {
                            type = spec.items.type + "[]";
                            break;
                        } else if (spec.items["$ref"]) {
                            type = spec.items["$ref"] + "[]";
                            break;
                        }
                        type = "[]";
                        break;
                    default:
                        if (spec.type) {
                            type = spec.type;
                        }
                        break;
                }
                res.push(d(label, `${ label }: ${ type }`, spec.description));
            });
        });
        return res;
    }
}

function d(name: string, use: string, doc: string): vscode.CompletionItem {
    const i = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
    i.detail = use;
    i.documentation = doc;
    return i;
}

function val(name: string, use: string, doc: string): vscode.CompletionItem {
    const i = new vscode.CompletionItem(name, vscode.CompletionItemKind.Value);
    i.detail = use;
    i.documentation = doc;
    return i;
}