import * as sysfs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import * as assert from 'assert';
import * as textassert from './textassert';
import * as fakes from './fakes';

import { Host } from '../src/host';
import { Shell, ShellResult } from '../src/shell';
import * as kubeExplorer from '../src/explorer';
import * as kuberesources from '../src/kuberesources';

interface FakeContext {
    host? : any;
    kubectl? : any;
}

function explorerCreateWithFakes(ctx : FakeContext) {
    return kubeExplorer.create(
        ctx.kubectl || fakes.kubectl(),
        ctx.host || fakes.host()
    );
}

suite("Explorer tests", () => {

    suite("getChildren method", () => {

        suite("If getting the root nodes", () => {

            test("...it returns a set of Kubernetes clusters", async () => {
                const explorer = explorerCreateWithFakes({
                    kubectl: fakes.kubectl({
                        invokeAsync(cmd: string): ShellResult {
                            if (cmd === "config view -o json") {
                                return {
                                    code: 0,
                                    stdout: sysfs.readFileSync(path.join(__dirname, "../../test/kube-config.json"), 'utf-8'),
                                    stderr: ""
                                };
                            }
                            return {
                                code: 0,
                                stdout: "",
                                stderr: ""
                            };
                        }
                    })
                });
                const roots = await explorer.getChildren(undefined);
                assert.equal(roots.length, 1);
                assert.equal(roots[0]['id'], "minikube");
            });
        });

        suite("If getting child nodes", () => {

            test("...kubectl requests the right objects", async () => {
                let command : string = undefined;
                const explorer = explorerCreateWithFakes({
                    kubectl: fakes.kubectl({ asLines: (c) => { command = c; return ["a"]; } })
                });
                const parent : any = kubeExplorer.createKubernetesResourceFolder(kuberesources.allKinds.pod);
                const nodes = await explorer.getChildren(parent);
                assert.equal(command, "get pod");
            });

            test("...and kubectl succeeds, it returns an object per output row", async () => {
                const explorer = explorerCreateWithFakes({
                    kubectl: fakes.kubectl({ asLines: (_) => ["a b c", "d e f"]})
                });
                const parent : any = kubeExplorer.createKubernetesResourceFolder(kuberesources.allKinds.pod);
                const nodes = await explorer.getChildren(parent);
                assert.equal(nodes.length, 2);
            });

            test("...it parses the IDs from the kubectl output rows", async () => {
                const explorer = explorerCreateWithFakes({
                    kubectl: fakes.kubectl({ asLines: (_) => ["a b c", "d e f"]})
                });
                const parent : any = kubeExplorer.createKubernetesResourceFolder(kuberesources.allKinds.pod);
                const nodes = await explorer.getChildren(parent);
                assert.equal(nodes[0].id, 'a');
                assert.equal(nodes[1].id, 'd');
            });

            test("...and kubectl fails, it returns an error node", async () => {
                const explorer = explorerCreateWithFakes({
                    kubectl: fakes.kubectl({ asLines: (_) => { return { code: 1, stdout: "", stderr: "Oh no!"}; } })
                });
                const parent : any = kubeExplorer.createKubernetesResourceFolder(kuberesources.allKinds.pod);
                const nodes = await explorer.getChildren(parent);
                assert.equal(nodes.length, 1);
                assert.equal(nodes[0].id, "Error");
            });

            test("...and kubectl fails, the error is displayed", async () => {
                let errors : string[] = [];
                const explorer = explorerCreateWithFakes({
                    kubectl: fakes.kubectl({ asLines: (_) => { return { code: 1, stdout: "", stderr: "Oh no!"}; } }),
                    host: fakes.host({errors: errors})
                });
                const parent : any = kubeExplorer.createKubernetesResourceFolder(kuberesources.allKinds.pod);
                const nodes = await explorer.getChildren(parent);
                assert.equal(errors.length, 1);
                assert.equal(errors[0], "Oh no!");
            });
        });
    });

    suite("getTreeItem method", () => {

        suite("If getting a tree item for a Kubernetes kind", () => {

            test("...it is expandable", async () => {
                const explorer = explorerCreateWithFakes({});
                const obj : any = kubeExplorer.createKubernetesResourceFolder(kuberesources.allKinds.pod);
                const treeItem = await explorer.getTreeItem(obj);
                assert.equal(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
            });

            test("...its label is the kind plural name", async () => {
                const explorer = explorerCreateWithFakes({});
                const obj : any = kubeExplorer.createKubernetesResourceFolder(kuberesources.allKinds.deployment);
                const treeItem = await explorer.getTreeItem(obj);
                assert.equal(treeItem.label, 'Deployments');
            });
        });

        suite("If getting a tree item for a Kubernetes object", () => {

            test("...it is not expandable", async () => {
                const explorer = explorerCreateWithFakes({});
                const obj : any = kubeExplorer.createKubernetesResource(kuberesources.allKinds.pod, "my-pod");
                const treeItem = await explorer.getTreeItem(obj);
                assert.equal(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.None);
            });

            test("...its label is the ID", async () => {
                const explorer = explorerCreateWithFakes({});
                const obj : any = kubeExplorer.createKubernetesResource(kuberesources.allKinds.pod, "my-pod");
                const treeItem = await explorer.getTreeItem(obj);
                assert.equal(treeItem.label, 'my-pod');
            });
        });
    });
});
