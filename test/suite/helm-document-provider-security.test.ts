import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as helmExec from '../../src/helm.exec';
import * as helm from '../../src/helm';
import {
    HelmDependencyDocumentProvider,
    HelmInspectDocumentProvider,
    HelmValuesDocumentProvider,
} from '../../src/helm.documentProvider';
import { helmChartQuery } from '../../src/components/helm/commands';

suite('Helm document provider security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => sandbox.restore());

    test('passes repository chart values as exact arguments', async () => {
        sandbox.stub(helmExec, 'helmSyntaxVersion').resolves(helmExec.HelmSyntaxVersion.V3);
        const helmExecArgsAsync = sandbox.stub(helmExec, 'helmExecArgsAsync').resolves({
            code: 0,
            stdout: 'replicaCount: 1\n',
            stderr: '',
        });
        const chart = 'repo/chart;$(marker)&value';
        const uri = vscode.Uri.from({
            scheme: helm.FETCH_VALUES_SCHEME,
            authority: helm.INSPECT_REPO_AUTHORITY,
            path: '/values.yaml',
            query: helmChartQuery(chart, '1.2.3'),
        });

        const content = await new HelmValuesDocumentProvider().provideTextDocumentContent(
            uri,
            {} as vscode.CancellationToken
        );

        assert.strictEqual(content, 'replicaCount: 1\n');
        sinon.assert.calledOnceWithExactly(helmExecArgsAsync, [
            'inspect', 'values', chart, '--version', '1.2.3'
        ]);
    });

    test('rejects duplicate chart fields before execution', async () => {
        const helmExecArgsAsync = sandbox.stub(helmExec, 'helmExecArgsAsync');
        const uri = vscode.Uri.from({
            scheme: helm.FETCH_VALUES_SCHEME,
            authority: helm.INSPECT_REPO_AUTHORITY,
            path: '/values.yaml',
            query: 'chart=repo%2Fone&chart=repo%2Ftwo&version=1.2.3',
        });

        await assert.rejects(
            () => new HelmValuesDocumentProvider().provideTextDocumentContent(uri, {} as vscode.CancellationToken),
            /Invalid Helm values URI/
        );
        sinon.assert.notCalled(helmExecArgsAsync);
    });

    test('escapes inspect titles and Helm output', async () => {
        sandbox.stub(helmExec, 'helmSyntaxVersion').resolves(helmExec.HelmSyntaxVersion.V4);
        const helmExecArgsAsync = sandbox.stub(helmExec, 'helmExecArgsAsync').resolves({
            code: 0,
            stdout: '<script>payload()</script>',
            stderr: '',
        });
        const chart = 'repo/chart&display';
        const uri = vscode.Uri.from({
            scheme: helm.INSPECT_CHART_SCHEME,
            authority: helm.INSPECT_REPO_AUTHORITY,
            path: '/chart.html',
            query: helmChartQuery(chart, '2.0.0'),
        });

        const content = await new HelmInspectDocumentProvider().provideTextDocumentContent(
            uri,
            {} as vscode.CancellationToken
        );

        assert.ok(content.includes('Inspect repo/chart&amp;display 2.0.0'));
        assert.ok(content.includes('&lt;script&gt;payload()&lt;/script&gt;'));
        assert.ok(!content.includes('<script>payload()</script>'));
        sinon.assert.calledOnceWithExactly(helmExecArgsAsync, [
            'inspect', 'all', chart, '--version', '2.0.0'
        ]);
    });

    test('escapes dependency metadata and malformed URI errors', async () => {
        const provider = new HelmDependencyDocumentProvider();
        const item = provider.formatDependency({
            name: '<img src=x onerror=marker()>',
            version: '1.2.3',
            repository: 'https://example.test/?q=<marker>',
            status: '<failed>',
        });

        assert.ok(item.includes('&lt;img src=x onerror=marker()&gt;'));
        assert.ok(item.includes('&lt;marker&gt;'));
        assert.ok(item.includes('&lt;failed&gt;'));
        assert.ok(!item.includes('<img'));

        const invalid = await provider.provideTextDocumentContentImpl(vscode.Uri.from({
            scheme: helm.DEPENDENCIES_SCHEME,
            authority: helm.DEPENDENCIES_REPO_AUTHORITY,
            path: '/dependencies.html',
            query: 'chart=repo%2Fone&chart=repo%2Ftwo',
        }));
        assert.strictEqual(invalid, '<p>Invalid Helm dependencies URI.</p>');
    });
});
