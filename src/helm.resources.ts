import * as vscode from 'vscode';
import * as v1 from './v1';
import * as _ from 'lodash';
import * as shell from 'shelljs';
import * as filepath from 'path';

// Resources describes Kubernetes resource keywords.
export class Resources {
    public all(): vscode.CompletionItem[] {
        let home = shell.env["HOME"];
        let schemaDir = filepath.join(home, ".kube/schema");
        if (!shell.test("-d", schemaDir)) {
            // Return the default set.
            return this.v1();
        }
        // Otherwise, try to dynamically build completion items from the
        // entire schema.
        let kversion = _.last(shell.ls(schemaDir));
        console.log("Loading schema for version " + kversion);

        // Inside of the schemaDir, there are some top-level copies of the schemata.
        // Instead of walking the tree, we just parse those.  Note that kubectl loads
        // schemata on demand, which means we won't have an exhaustive list, but we are
        // more likely to get the ones that this user is actually using, including
        // TPRs.
        let res = [];
        let path = filepath.join(schemaDir, kversion);
        shell.ls(path).forEach((item) => {
            let itemPath = filepath.join(path, item);
            if (shell.test('-d', itemPath)) {
                return;
            }
            let schema = JSON.parse(shell.cat(itemPath));
            if (!schema.models) {
                return;
            }
            console.log("Adding schema " + itemPath);
            res = res.concat(this.fromSchema(schema.models));
        });
        console.log("Attached " + res.length + " resource kinds");
        return res;
    }

    v1(): vscode.CompletionItem[] {
        return this.fromSchema(v1.default.models);
    }

    // Extract hover documentation from a Swagger model.
    fromSchema(schema): vscode.CompletionItem[] {
        let res = [];
        _.each(schema, (v, k) => {
            let i = k.lastIndexOf(".");
            //let version = k.substr(0, i)
            let kind = k.substr(i+1);
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
                        if(spec.items.type) {
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
    let i = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
    i.detail = use;
    i.documentation = doc;
    return i;
}
function val(name: string, use: string, doc: string): vscode.CompletionItem {
    let i = new vscode.CompletionItem(name, vscode.CompletionItemKind.Value);
    i.detail = use;
    i.documentation = doc;
    return i;
}