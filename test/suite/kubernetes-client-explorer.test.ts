import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { createServer } from 'http';
import { Disposable, window } from 'vscode';
import { host } from '../../src/host';
import type { Kubectl } from '../../src/kubectl';
import * as config from '../../src/components/config/config';
import { KubernetesExplorer } from '../../src/components/clusterexplorer/explorer';
import { currentNamespace, getCurrentClusterConfig, getCurrentContext } from '../../src/kubectlUtils';

suite('Kubernetes client namespace explorer', () => {
    test('discovers contexts and renders namespaces alongside an incomplete inactive context without kubectl', async () => {
        const sandbox = sinon.createSandbox();
        const errors = sandbox.stub(window, 'showErrorMessage').resolves(undefined);
        sandbox.stub(process, 'env').value({ ...process.env, HTTP_PROXY: '', HTTPS_PROXY: '', http_proxy: '', https_proxy: '' });
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'k8s-namespace-explorer-'));
        const unexpectedCommand = sandbox.stub().rejects(new Error('The namespace explorer must not run kubectl.'));
        const kubectl = { invokeCommandArgs: unexpectedCommand, asJsonArgs: unexpectedCommand,
            executeCommandArgs: unexpectedCommand } as unknown as Kubectl;
        const requests: string[] = [];
        const server = createServer((request, response) => {
            requests.push(request.url!);
            response.setHeader('content-type', 'application/json');
            response.end(JSON.stringify({ kind: 'NamespaceList', apiVersion: 'v1', items: [
                { metadata: { name: 'default' } },
                { metadata: { name: 'team-a', labels: { owner: 'team' } } },
            ] }));
        });
        try {
            await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
            const address = server.address();
            assert.ok(address && typeof address !== 'string');
            const configFile = path.join(directory, 'config');
            fs.writeFileSync(configFile, JSON.stringify({
                apiVersion: 'v1', kind: 'Config',
                clusters: [{ name: 'cluster', cluster: { server: `http://127.0.0.1:${address.port}`, 'insecure-skip-tls-verify': true } }],
                contexts: [
                    { name: 'selected', context: { cluster: 'cluster', user: 'user', namespace: 'team-a' } },
                    { name: 'scratch', context: { namespace: 'other' } },
                ],
                users: [{ name: 'user', user: { token: 'synthetic-token' } }],
                'current-context': 'selected',
            }));
            sandbox.stub(config, 'getActiveKubeconfig').returns(configFile);
            sandbox.stub(config, 'getUseWsl').returns(false);
            sandbox.stub(host, 'onDidChangeConfiguration').returns(new Disposable(() => {}));
            const explorer = new KubernetesExplorer(kubectl, host);

            const contexts = await explorer.getChildren();
            assert.strictEqual(contexts!.length, 2);
            assert.strictEqual((await explorer.getTreeItem(contexts![0])).label, 'selected');
            assert.strictEqual((await explorer.getTreeItem(contexts![1])).label, 'scratch');
            assert.strictEqual((await getCurrentContext(kubectl, {}))?.contextName, 'selected');
            assert.strictEqual(await currentNamespace(kubectl), 'team-a');
            assert.strictEqual((await getCurrentClusterConfig(kubectl, {}))?.server, `http://127.0.0.1:${address.port}`);
            const folders = await explorer.getChildren(contexts![0]);
            const namespaceFolder = folders!.find((node) => node.nodeType === 'folder.resource' && node.kind.abbreviation === 'namespace');
            assert.ok(namespaceFolder);
            const namespaces = await explorer.getChildren(namespaceFolder);
            const treeItems = await Promise.all(namespaces!.map((node) => explorer.getTreeItem(node)));

            assert.ok(!errors.called, errors.firstCall?.args[0]);
            assert.deepStrictEqual(treeItems.map((item) => item.label), ['default', '* team-a']);
            const active = namespaces!.find((node) => node.nodeType === 'resource' && node.name === 'team-a');
            assert.ok(active && active.nodeType === 'resource');
            assert.deepStrictEqual(active.metadata.labels, { owner: 'team' });
            assert.deepStrictEqual(requests.map((url) => new URL(url, 'http://localhost').pathname), ['/api/v1/namespaces']);
            sinon.assert.notCalled(unexpectedCommand);
        } finally {
            server.closeAllConnections();
            await new Promise<void>((resolve) => server.close(() => resolve()));
            sandbox.restore();
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });
});
