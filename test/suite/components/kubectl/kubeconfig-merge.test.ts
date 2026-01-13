import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fsNode from 'fs';
import * as yaml from 'js-yaml';
import { mergeToKubeconfig } from '../../../../src/components/kubectl/kubeconfig';

// Simulates user clicking a specific button in a warning message dialog.
// Note: we use callsFake with as any to handle overloaded method signatures.
function stubWarningMessage(sandbox: sinon.SinonSandbox, response: string | undefined): void {
    sandbox.stub(vscode.window, 'showWarningMessage').callsFake(async () => response as any);
}

/**
 * Test suite for mergeToKubeconfig functionality.
 * 
 * These tests verify the kubeconfig merge behavior including:
 * - Merging new clusters into empty kubeconfig
 * - Handling duplicate names with Overwrite/Keep Both/Cancel options
 * - AKS-specific suffix generation (resource group extraction)
 * - Counter-based suffix for non-AKS clusters
 * - Multi-path KUBECONFIG handling (uses first path)
 */

suite("Kubeconfig Merge", () => {
    let sandbox: sinon.SinonSandbox;
    let tempDir: string;
    let originalKubeconfig: string | undefined;
    let refreshExplorerDisposable: vscode.Disposable;

    // Helper to create a temp kubeconfig file & set the corresponding env var
    function setupKubeconfig(content: string): string {
        const kcPath = path.join(tempDir, 'config');
        fsNode.writeFileSync(kcPath, content);
        process.env['KUBECONFIG'] = kcPath;
        return kcPath;
    }

    // Helper to read the resulting kubeconfig
    function readKubeconfig(kcPath: string): any {
        const content = fsNode.readFileSync(kcPath, 'utf8');
        return yaml.load(content);
    }

    // Helper to create a valid minimal kubeconfig YAML
    function makeConfig(opts: {
        clusterName: string;
        userName: string;
        contextName: string;
        server?: string;
    }): string {
        return yaml.dump({
            apiVersion: 'v1',
            kind: 'Config',
            clusters: [{
                name: opts.clusterName,
                cluster: { server: opts.server || 'https://example.com' }
            }],
            users: [{
                name: opts.userName,
                user: {}
            }],
            contexts: [{
                name: opts.contextName,
                context: {
                    cluster: opts.clusterName,
                    user: opts.userName
                }
            }],
            'current-context': opts.contextName
        });
    }

    setup(() => {
        sandbox = sinon.createSandbox();
        tempDir = fsNode.mkdtempSync(path.join(os.tmpdir(), 'kubeconfig-test-'));
        originalKubeconfig = process.env['KUBECONFIG'];

        // Register dummy refresh command to prevent invocation for tests
        refreshExplorerDisposable = vscode.commands.registerCommand(
            'extension.vsKubernetesRefreshExplorer',
            () => { /* no-op for tests */ }
        );

        // Stub UI functions to prevent popups / blocks
        sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
        sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
    });

    teardown(() => {
        sandbox.restore();
        refreshExplorerDisposable.dispose();
        // Restore original KUBECONFIG
        if (originalKubeconfig) {
            process.env['KUBECONFIG'] = originalKubeconfig;
        } else {
            delete process.env['KUBECONFIG'];
        }
        // Cleanup temp directory
        fsNode.rmSync(tempDir, { recursive: true, force: true });
    });

    suite("merging to empty kubeconfig", () => {
        test("creates new kubeconfig with cluster, user, and context", async () => {
            const kcPath = path.join(tempDir, 'config');
            process.env['KUBECONFIG'] = kcPath;

            const newConfig = makeConfig({
                clusterName: 'new-cluster',
                userName: 'new-user',
                contextName: 'new-context',
                server: 'https://new-server.com'
            });

            await mergeToKubeconfig(newConfig);

            const result = readKubeconfig(kcPath);
            assert.strictEqual(result.clusters.length, 1);
            assert.strictEqual(result.clusters[0].name, 'new-cluster');
            assert.strictEqual(result.users[0].name, 'new-user');
            assert.strictEqual(result.contexts[0].name, 'new-context');
            assert.strictEqual(result['current-context'], 'new-context');
        });
    });

    suite("merging without duplicates", () => {
        test("adds new cluster to existing kubeconfig", async () => {
            const existing = makeConfig({
                clusterName: 'existing-cluster',
                userName: 'existing-user',
                contextName: 'existing-context'
            });
            const kcPath = setupKubeconfig(existing);

            const newConfig = makeConfig({
                clusterName: 'new-cluster',
                userName: 'new-user',
                contextName: 'new-context'
            });

            await mergeToKubeconfig(newConfig);

            const result = readKubeconfig(kcPath);
            assert.strictEqual(result.clusters.length, 2);
            assert.ok(result.clusters.some((c: any) => c.name === 'existing-cluster'));
            assert.ok(result.clusters.some((c: any) => c.name === 'new-cluster'));
            assert.strictEqual(result.users.length, 2);
            assert.ok(result.users.some((u: any) => u.name === 'existing-user'));
            assert.ok(result.users.some((u: any) => u.name === 'new-user'));
            assert.strictEqual(result.contexts.length, 2);
            assert.ok(result.contexts.some((c: any) => c.name === 'existing-context'));
            assert.ok(result.contexts.some((c: any) => c.name === 'new-context'));
        });
    });

    suite("duplicate handling - Cancel", () => {
        test("cancels merge when user clicks Cancel", async () => {
            const existing = makeConfig({
                clusterName: 'my-cluster',
                userName: 'my-user',
                contextName: 'my-context'
            });
            const kcPath = setupKubeconfig(existing);
            const originalContent = fsNode.readFileSync(kcPath, 'utf8');

            // Stub warning message to return 'Cancel'
            sandbox.restore(); // Removes previous stubs
            sandbox = sinon.createSandbox();
            stubWarningMessage(sandbox, 'Cancel');
            sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

            const newConfig = makeConfig({
                clusterName: 'my-cluster',  // Same name = duplicate
                userName: 'my-user',
                contextName: 'my-context'
            });

            await mergeToKubeconfig(newConfig);

            // File should be unchanged
            const afterContent = fsNode.readFileSync(kcPath, 'utf8');
            assert.strictEqual(afterContent, originalContent);
        });

        test("cancels merge when user dismisses dialog (undefined)", async () => {
            const existing = makeConfig({
                clusterName: 'my-cluster',
                userName: 'my-user',
                contextName: 'my-context'
            });
            const kcPath = setupKubeconfig(existing);
            const originalContent = fsNode.readFileSync(kcPath, 'utf8');

            sandbox.restore();
            sandbox = sinon.createSandbox();
            stubWarningMessage(sandbox, undefined);
            sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

            const newConfig = makeConfig({
                clusterName: 'my-cluster',
                userName: 'my-user',
                contextName: 'my-context'
            });

            await mergeToKubeconfig(newConfig);

            // File should be unchanged
            const afterContent = fsNode.readFileSync(kcPath, 'utf8');
            assert.strictEqual(afterContent, originalContent);
        });
    });

    suite("duplicate handling - Overwrite", () => {
        test("overwrites existing cluster when user clicks Overwrite", async () => {
            const existing = makeConfig({
                clusterName: 'my-cluster',
                userName: 'my-user',
                contextName: 'my-context'
            });
            const kcPath = setupKubeconfig(existing);

            sandbox.restore();
            sandbox = sinon.createSandbox();
            stubWarningMessage(sandbox, 'Overwrite');
            sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

            // New config with same name but different server
            const newConfig = yaml.dump({
                apiVersion: 'v1',
                kind: 'Config',
                clusters: [{
                    name: 'my-cluster',
                    cluster: { server: 'https://UPDATED-server.com' }
                }],
                users: [{ name: 'my-user', user: {} }],
                contexts: [{
                    name: 'my-context',
                    context: { cluster: 'my-cluster', user: 'my-user' }
                }]
            });

            await mergeToKubeconfig(newConfig);

            // Only one of each should exist (overwritten, not duplicated)
            const result = readKubeconfig(kcPath);
            assert.strictEqual(result.clusters.length, 1);
            assert.strictEqual(result.clusters[0].name, 'my-cluster');
            assert.strictEqual(result.clusters[0].cluster.server, 'https://UPDATED-server.com');
            assert.strictEqual(result.users.length, 1);
            assert.strictEqual(result.users[0].name, 'my-user');
            assert.strictEqual(result.contexts.length, 1);
            assert.strictEqual(result.contexts[0].name, 'my-context');
        });
    });

    suite("duplicate handling - Keep Both", () => {
        test("adds suffix (2) for non-AKS cluster on Keep Both", async () => {
            const existing = makeConfig({
                clusterName: 'my-cluster',
                userName: 'my-user',
                contextName: 'my-context'
            });
            const kcPath = setupKubeconfig(existing);

            sandbox.restore();
            sandbox = sinon.createSandbox();
            stubWarningMessage(sandbox, 'Keep Both');
            sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

            const newConfig = makeConfig({
                clusterName: 'my-cluster',
                userName: 'my-user',
                contextName: 'my-context'
            });

            await mergeToKubeconfig(newConfig);

            // Verify both entries exist with (2) suffix for cluster, user, and context
            const result = readKubeconfig(kcPath);
            assert.strictEqual(result.clusters.length, 2);
            assert.ok(result.clusters.some((c: any) => c.name === 'my-cluster'));
            assert.ok(result.clusters.some((c: any) => c.name === 'my-cluster (2)'));
            assert.strictEqual(result.users.length, 2);
            assert.ok(result.users.some((u: any) => u.name === 'my-user'));
            assert.ok(result.users.some((u: any) => u.name === 'my-user (2)'));
            assert.strictEqual(result.contexts.length, 2);
            assert.ok(result.contexts.some((c: any) => c.name === 'my-context'));
            assert.ok(result.contexts.some((c: any) => c.name === 'my-context (2)'));
        });

        test("increments counter when (2) already exists", async () => {
            // Existing kubeconfig already has my-cluster and my-cluster (2)
            const existingConfig = yaml.dump({
                apiVersion: 'v1',
                kind: 'Config',
                clusters: [
                    { name: 'my-cluster', cluster: { server: 'https://server1.com' } },
                    { name: 'my-cluster (2)', cluster: { server: 'https://server2.com' } }
                ],
                users: [
                    { name: 'my-user', user: {} },
                    { name: 'my-user (2)', user: {} }
                ],
                contexts: [
                    { name: 'my-context', context: { cluster: 'my-cluster', user: 'my-user' } },
                    { name: 'my-context (2)', context: { cluster: 'my-cluster (2)', user: 'my-user (2)' } }
                ],
                'current-context': 'my-context'
            });
            const kcPath = setupKubeconfig(existingConfig);

            sandbox.restore();
            sandbox = sinon.createSandbox();
            stubWarningMessage(sandbox, 'Keep Both');
            sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

            const newConfig = makeConfig({
                clusterName: 'my-cluster',
                userName: 'my-user',
                contextName: 'my-context'
            });

            await mergeToKubeconfig(newConfig);

            // All three entity types should have incremented (3) suffix
            const result = readKubeconfig(kcPath);
            assert.strictEqual(result.clusters.length, 3);
            assert.ok(result.clusters.some((c: any) => c.name === 'my-cluster (3)'));
            assert.strictEqual(result.users.length, 3);
            assert.ok(result.users.some((u: any) => u.name === 'my-user (3)'));
            assert.strictEqual(result.contexts.length, 3);
            assert.ok(result.contexts.some((c: any) => c.name === 'my-context (3)'));
        });
    });

    suite("AKS-specific suffix handling", () => {
        test("uses resource group as suffix for AKS pattern user names", async () => {
            const existing = makeConfig({
                clusterName: 'my-aks-cluster',
                userName: 'clusterUser_myResourceGroup_my-aks-cluster',
                contextName: 'my-aks-cluster'
            });
            const kcPath = setupKubeconfig(existing);

            sandbox.restore();
            sandbox = sinon.createSandbox();
            stubWarningMessage(sandbox, 'Keep Both');
            sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

            // New cluster from different resource group
            const newConfig = yaml.dump({
                apiVersion: 'v1',
                kind: 'Config',
                clusters: [{
                    name: 'my-aks-cluster',
                    cluster: { server: 'https://new-aks-server.com' }
                }],
                users: [{
                    name: 'clusterUser_differentRG_my-aks-cluster',
                    user: {}
                }],
                contexts: [{
                    name: 'my-aks-cluster',
                    context: { cluster: 'my-aks-cluster', user: 'clusterUser_differentRG_my-aks-cluster' }
                }]
            });

            await mergeToKubeconfig(newConfig);

            const result = readKubeconfig(kcPath);
            assert.strictEqual(result.clusters.length, 2);
            // Should use 'differentRG' as suffix, not a counter
            assert.ok(result.clusters.some((c: any) => c.name === 'my-aks-cluster (differentRG)'),
                `Expected 'my-aks-cluster (differentRG)', got: ${result.clusters.map((c: any) => c.name).join(', ')}`);
            assert.strictEqual(result.users.length, 2);
            assert.ok(result.users.some((u: any) => u.name === 'clusterUser_differentRG_my-aks-cluster (differentRG)'));
            assert.strictEqual(result.contexts.length, 2);
            assert.ok(result.contexts.some((c: any) => c.name === 'my-aks-cluster (differentRG)'));
        });

        test("adds counter when same resource group suffix already exists", async () => {
            // Existing already has cluster with (myRG) suffix
            const existingConfig = yaml.dump({
                apiVersion: 'v1',
                kind: 'Config',
                clusters: [
                    { name: 'my-aks-cluster', cluster: { server: 'https://server1.com' } },
                    { name: 'my-aks-cluster (myRG)', cluster: { server: 'https://server2.com' } }
                ],
                users: [
                    { name: 'clusterUser_myRG_my-aks-cluster', user: {} },
                    { name: 'clusterUser_myRG_my-aks-cluster (myRG)', user: {} }
                ],
                contexts: [
                    { name: 'my-aks-cluster', context: { cluster: 'my-aks-cluster', user: 'clusterUser_myRG_my-aks-cluster' } },
                    { name: 'my-aks-cluster (myRG)', context: { cluster: 'my-aks-cluster (myRG)', user: 'clusterUser_myRG_my-aks-cluster (myRG)' } }
                ],
                'current-context': 'my-aks-cluster'
            });
            const kcPath = setupKubeconfig(existingConfig);

            sandbox.restore();
            sandbox = sinon.createSandbox();
            stubWarningMessage(sandbox, 'Keep Both');
            sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

            // Another cluster from same resource group
            const newConfig = yaml.dump({
                apiVersion: 'v1',
                kind: 'Config',
                clusters: [{
                    name: 'my-aks-cluster',
                    cluster: { server: 'https://server3.com' }
                }],
                users: [{
                    name: 'clusterUser_myRG_my-aks-cluster',
                    user: {}
                }],
                contexts: [{
                    name: 'my-aks-cluster',
                    context: { cluster: 'my-aks-cluster', user: 'clusterUser_myRG_my-aks-cluster' }
                }]
            });

            await mergeToKubeconfig(newConfig);

            const result = readKubeconfig(kcPath);
            assert.strictEqual(result.clusters.length, 3);
            // Should have counter since (myRG) already exists
            assert.ok(result.clusters.some((c: any) => c.name.includes('(myRG)') && c.name.includes('(2)')),
                `Expected suffix with counter, got: ${result.clusters.map((c: any) => c.name).join(', ')}`);
            assert.strictEqual(result.users.length, 3);
            assert.ok(result.users.some((u: any) => u.name.includes('(myRG)') && u.name.includes('(2)')),
                `Expected user with counter, got: ${result.users.map((u: any) => u.name).join(', ')}`);
            assert.strictEqual(result.contexts.length, 3);
            assert.ok(result.contexts.some((c: any) => c.name.includes('(myRG)') && c.name.includes('(2)')),
                `Expected context with counter, got: ${result.contexts.map((c: any) => c.name).join(', ')}`);
        });
    });

    suite("context reference updates", () => {
        test("context references updated cluster and user names after Keep Both rename", async () => {
            const existing = makeConfig({
                clusterName: 'my-cluster',
                userName: 'my-user',
                contextName: 'my-context'
            });
            const kcPath = setupKubeconfig(existing);

            sandbox.restore();
            sandbox = sinon.createSandbox();
            stubWarningMessage(sandbox, 'Keep Both');
            sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

            const newConfig = makeConfig({
                clusterName: 'my-cluster',
                userName: 'my-user',
                contextName: 'my-context'
            });

            await mergeToKubeconfig(newConfig);

            const result = readKubeconfig(kcPath);
            const renamedContext = result.contexts.find((c: any) => c.name === 'my-context (2)');
            assert.ok(renamedContext, 'Should have renamed context');
            assert.strictEqual(renamedContext.context.cluster, 'my-cluster (2)');
            assert.strictEqual(renamedContext.context.user, 'my-user (2)');
        });
    });

    suite("backup file handling", () => {
        test("creates backup file before overwriting", async () => {
            const existing = makeConfig({
                clusterName: 'my-cluster',
                userName: 'my-user',
                contextName: 'my-context'
            });
            const kcPath = setupKubeconfig(existing);

            sandbox.restore();
            sandbox = sinon.createSandbox();
            stubWarningMessage(sandbox, 'Overwrite');
            sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

            const newConfig = makeConfig({
                clusterName: 'my-cluster',
                userName: 'my-user',
                contextName: 'my-context'
            });

            await mergeToKubeconfig(newConfig);

            const backupPath = kcPath + '.vscode-k8s-tools-backup';
            assert.ok(fsNode.existsSync(backupPath), 'Backup file should exist');
        });
    });

    suite("multi-path KUBECONFIG", () => {
        test("uses first path when KUBECONFIG contains multiple paths", async () => {
            const firstPath = path.join(tempDir, 'config1');
            const secondPath = path.join(tempDir, 'config2');
            
            // Create first config
            const existingConfig = makeConfig({
                clusterName: 'existing-cluster',
                userName: 'existing-user',
                contextName: 'existing-context'
            });
            fsNode.writeFileSync(firstPath, existingConfig);
            fsNode.writeFileSync(secondPath, ''); // Empty second config
            
            // Set multi-path KUBECONFIG
            process.env['KUBECONFIG'] = `${firstPath}${path.delimiter}${secondPath}`;

            const newConfig = makeConfig({
                clusterName: 'new-cluster',
                userName: 'new-user',
                contextName: 'new-context'
            });

            await mergeToKubeconfig(newConfig);

            // Should merge to first path only
            const result = readKubeconfig(firstPath);
            assert.strictEqual(result.clusters.length, 2);
            
            // Second path should be unchanged (empty)
            const secondContent = fsNode.readFileSync(secondPath, 'utf8');
            assert.strictEqual(secondContent, '');
        });
    });
});
