import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as helmExec from '../../src/helm.exec';
import { create } from '../../src/helm.repoExplorer';
import { Host } from '../../src/host';

suite('Helm repository security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => sandbox.restore());

    test('keeps a repository returned by Helm as one search argument', async () => {
        const repositoryName = 'repo;$(marker)&value';
        const helmExecArgsAsync = sandbox.stub(helmExec, 'helmExecArgsAsync');
        helmExecArgsAsync.onFirstCall().resolves({
            code: 0,
            stdout: `NAME\tURL\n${repositoryName}\thttps://example.test/charts\n`,
            stderr: '',
        });
        helmExecArgsAsync.onSecondCall().resolves({
            code: 0,
            stdout: `NAME\tCHART VERSION\tAPP VERSION\tDESCRIPTION\n${repositoryName}/widget&value\t1.2.3\t4.5.6\tA chart\n`,
            stderr: '',
        });
        sandbox.stub(helmExec, 'helmSyntaxVersion').resolves(helmExec.HelmSyntaxVersion.V4);
        const explorer = create({
            onDidChangeConfiguration: () => new vscode.Disposable(() => {}),
        } as unknown as Host);

        const repositories = await Promise.resolve(explorer.getChildren());
        assert.ok(repositories);
        assert.strictEqual(repositories.length, 1);
        const charts = await repositories[0].getChildren();

        assert.strictEqual(charts.length, 1);
        sinon.assert.calledWithExactly(helmExecArgsAsync.firstCall, ['repo', 'list']);
        sinon.assert.calledWithExactly(helmExecArgsAsync.secondCall, [
            'search', 'repo', `${repositoryName}/`, '--versions'
        ]);
    });

    test('rejects a control character in repository output before follow-up execution', async () => {
        const helmExecArgsAsync = sandbox.stub(helmExec, 'helmExecArgsAsync').resolves({
            code: 0,
            stdout: 'NAME\tURL\nrepo\rname\thttps://example.test/charts\n',
            stderr: '',
        });
        const explorer = create({
            onDidChangeConfiguration: () => new vscode.Disposable(() => {}),
        } as unknown as Host);

        const repositories = await Promise.resolve(explorer.getChildren());

        assert.ok(repositories);
        assert.strictEqual(repositories.length, 1);
        const item = repositories[0].getTreeItem();
        assert.strictEqual(item.label, 'Unable to list Helm repos');
        sinon.assert.calledOnce(helmExecArgsAsync);
    });
});
