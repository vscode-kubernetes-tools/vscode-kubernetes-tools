import * as assert from 'assert';
import * as querystring from 'querystring';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as helmExec from '../../src/helm.exec';
import * as helmExecutable from '../../src/components/helm/executable';
import * as explorer from '../../src/components/clusterprovider/common/explorer';
import * as kubectlUtils from '../../src/kubectlUtils';
import { HelmHistoryNode, HelmReleaseNode } from '../../src/components/clusterexplorer/node.helmrelease';
import { HelmReleasesFolder } from '../../src/components/clusterexplorer/node.folder.helmreleases';
import { host, Host } from '../../src/host';
import { Kubectl } from '../../src/kubectl';
import { KubernetesResourceLinkProvider } from '../../src/kuberesources.linkprovider';
import { HELM_RESOURCE_AUTHORITY, K8S_RESOURCE_SCHEME, KubernetesResourceVirtualFileSystemProvider, kubefsUri } from '../../src/kuberesources.virtualfs';
import { shell, Shell } from '../../src/shell';
import '../../src/utils/array';

const executeHelmCommand = helmExecutable.executeHelmCommand;

suite('Helm release security', () => {
    let sandbox: sinon.SinonSandbox;
    let execute: sinon.SinonStub;
    let legacyExec: sinon.SinonStub;
    let warning: sinon.SinonStub;
    let error: sinon.SinonStub;
    let information: sinon.SinonStub;
    let refresh: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(shell, 'which').returns('/test/helm');
        legacyExec = sandbox.stub(shell, 'exec').rejects(new Error('Legacy Helm shell execution is not allowed.'));
        sandbox.stub(helmExecutable, 'resolveHelmExecutableForExecution').resolves({ path: process.execPath });
        execute = sandbox.stub(helmExecutable, 'executeHelmCommand');
        warning = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);
        error = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
        information = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
        refresh = sandbox.stub(explorer, 'refreshExplorer').resolves();
        sandbox.stub(host, 'longRunning').callsFake(async (_options, action) => action());
        respondToCommand('');
    });

    teardown(() => {
        try {
            sinon.assert.notCalled(legacyExec);
        } finally {
            sandbox.restore();
        }
    });

    test('round-trips release URI values without adding query fields or fragments', () => {
        const release = 'release &ns=other#fragment%25;$(marker)';
        const uri = helmExec.helmfsUri(release, 3);
        const query = querystring.parse(uri.query);

        assert.strictEqual(query.value, release);
        assert.strictEqual(query.revision, '3');
        assert.strictEqual(query.ns, undefined);
        assert.strictEqual(uri.fragment, '');
        assert.match(uri.path, /^\/helmrelease-[A-Za-z0-9._-]+\.txt$/);
    });

    test('keeps Helm 2 paging cursors as single arguments', async () => {
        const cursor = 'release;$(marker)&value';
        execute.onFirstCall().resolves({ code: 0, stdout: helm2ReleaseList('first', cursor), stderr: '' });
        execute.onSecondCall().resolves({ code: 0, stdout: helm2ReleaseList('second'), stderr: '' });

        const result = await helmExec.helmListAll('team-a');

        assert.strictEqual(result.succeeded, true);
        if (result.succeeded) {
            assert.deepStrictEqual(result.result.map((release) => release.name), ['first', 'second']);
        }
        assert.deepStrictEqual(execute.getCalls().map((call) => call.args[1]), [
            ['list', '--max', '0', '--output', 'json', '--namespace', 'team-a'],
            ['list', '--max', '0', '--output', 'json', '--namespace', 'team-a', '--offset', cursor],
        ]);
    });

    test('stops paging when the next page is empty', async () => {
        execute.onFirstCall().resolves({ code: 0, stdout: helm2ReleaseList('first', 'second'), stderr: '' });
        execute.onSecondCall().resolves({ code: 0, stdout: '', stderr: '' });
        execute.onThirdCall().rejects(new Error('Unexpected extra page.'));

        const result = await helmExec.helmListAll();

        assert.strictEqual(result.succeeded, true);
        if (result.succeeded) {
            assert.strictEqual(result.result.length, 1);
        }
        sinon.assert.calledTwice(execute);
        assert.deepStrictEqual(execute.secondCall.args[1], ['list', '--max', '0', '--output', 'json', '--offset', 'second']);
    });

    test('rejects repeated and cyclic paging cursors instead of looping', async () => {
        for (const cursors of [['same', 'same'], ['one', 'two', 'one']]) {
            execute.reset();
            cursors.forEach((cursor, index) => {
                execute.onCall(index).resolves({ code: 0, stdout: helm2ReleaseList('app', cursor), stderr: '' });
            });

            const result = await helmExec.helmListAll('team-a');

            assert.strictEqual(result.succeeded, false);
            if (!result.succeeded) {
                assert.match(result.error[0], /paging offset/);
            }
            assert.strictEqual(execute.callCount, cursors.length);
        }
    });

    test('rejects invalid paging cursors before another Helm invocation', async () => {
        for (const cursor of ['--kubeconfig=other', 'release\0name', 'x'.repeat(254), ' padded', 1, null, []]) {
            execute.reset();
            execute.resolves({ code: 0, stdout: JSON.stringify({ Next: cursor, Releases: [] }), stderr: '' });

            const result = await helmExec.helmListAll();

            assert.strictEqual(result.succeeded, false, JSON.stringify(cursor));
            sinon.assert.calledOnce(execute);
        }
    });

    test('lists releases without adding namespace or offset options when absent', async () => {
        execute.resolves({ code: 0, stdout: releaseList('app'), stderr: '' });

        const result = await helmExec.helmListAll('');

        assert.strictEqual(result.succeeded, true);
        assert.deepStrictEqual(execute.firstCall.args[1], ['list', '--max', '0', '--output', 'json']);
    });

    test('preserves a 63-character namespace from Helm 2 JSON without table truncation', async () => {
        const namespace = 'a'.repeat(63);
        execute.resolves({ code: 0, stdout: helm2ReleaseList('app', '', namespace), stderr: '' });

        const result = await helmExec.helmListAll(namespace);

        assert.strictEqual(result.succeeded, true);
        if (result.succeeded) {
            assert.deepStrictEqual(result.result, [{
                name: 'app', revision: '1', updated: 'Wed Oct 28 10:00:00 2026', status: 'DEPLOYED',
                chart: 'app-1.0.0', 'app version': '1.0', namespace,
            }]);
        }
        assert.deepStrictEqual(execute.firstCall.args[1], ['list', '--max', '0', '--output', 'json', '--namespace', namespace]);
    });

    test('preserves modern Helm JSON release fields without table parsing', async () => {
        const namespace = 'a'.repeat(63);
        execute.resolves({ code: 0, stdout: releaseList('app', namespace), stderr: '' });

        const result = await helmExec.helmListAll(namespace);

        assert.strictEqual(result.succeeded, true);
        if (result.succeeded) {
            assert.deepStrictEqual(result.result, [{
                name: 'app', namespace, revision: '1', updated: '2026-10-28T10:00:00Z', status: 'deployed',
                chart: 'app-1.0.0', 'app version': '1.0',
            }]);
        }
    });

    test('accepts empty JSON lists in both Helm response formats', async () => {
        for (const stdout of ['[]', helm2ReleaseList(undefined)]) {
            execute.reset();
            execute.resolves({ code: 0, stdout, stderr: '' });

            assert.deepStrictEqual(await helmExec.helmListAll(), { succeeded: true, result: [] });
            sinon.assert.calledOnce(execute);
        }
    });

    test('follows a Helm 2 cursor even when its current page has no releases', async () => {
        execute.onFirstCall().resolves({ code: 0, stdout: helm2ReleaseList(undefined, 'second'), stderr: '' });
        execute.onSecondCall().resolves({ code: 0, stdout: helm2ReleaseList('app'), stderr: '' });

        const result = await helmExec.helmListAll();

        assert.strictEqual(result.succeeded, true);
        if (result.succeeded) {
            assert.deepStrictEqual(result.result.map((release) => release.name), ['app']);
        }
        sinon.assert.calledTwice(execute);
    });

    test('rejects malformed release JSON and invalid field types', async () => {
        for (const stdout of [
            'not json', '{}', 'null', '1', '[null]', '[1]', '[[]]',
            '{"Next":"","Releases":{}}', '{"Releases":[]}',
            '[{"name":{},"status":"deployed"}]',
            '[{"name":"app","status":1}]',
            '[{"name":"app","status":"deployed","namespace":"team;$(marker)"}]',
            '[{"name":"app","status":"deployed","revision":{}}]',
            '{"Next":"","Releases":[{"Name":"app","Status":"DEPLOYED","Revision":1.5}]}',
        ]) {
            execute.reset();
            execute.resolves({ code: 0, stdout, stderr: '' });

            assert.strictEqual((await helmExec.helmListAll()).succeeded, false, stdout);
            sinon.assert.calledOnce(execute);
        }
    });

    test('reports list failures without returning partial results', async () => {
        execute.onFirstCall().resolves({ code: 0, stdout: helm2ReleaseList('first', 'second'), stderr: '' });
        execute.onSecondCall().resolves({ code: 7, stdout: 'partial output', stderr: 'list failed' });

        assert.deepStrictEqual(await helmExec.helmListAll('team-a'), { succeeded: false, error: ['list failed'] });
    });

    test('rejects invalid namespaces and release rows', async () => {
        assert.strictEqual((await helmExec.helmListAll('team;$(marker)')).succeeded, false);
        sinon.assert.notCalled(execute);

        execute.resolves({ code: 0, stdout: releaseList('--help'), stderr: '' });
        assert.strictEqual((await helmExec.helmListAll()).succeeded, false);
        sinon.assert.calledOnce(execute);
    });

    test('loads release history without shell interpretation', async () => {
        const release = 'release;$(marker)&value';
        execute.resolves({
            code: 0,
            stdout: JSON.stringify([{ revision: 1, updated: '2026-10-28', status: 'deployed', chart: 'app-1.0', app_version: '1.0', description: 'Installed' }]),
            stderr: '',
        });

        const result = await helmExec.helmGetHistory(release);

        assert.strictEqual(result.succeeded, true);
        sinon.assert.calledOnce(execute);
        assert.deepStrictEqual(execute.firstCall.args[1], ['history', '--output', 'json', '--', release]);
    });

    test('preserves namespace, reverse history ordering and both app-version spellings', async () => {
        respondToCommand(JSON.stringify([
            { ...historyRevision(1), appVersion: '1.0' },
            { ...historyRevision(2), app_version: '2.0' },
        ]));

        const result = await helmExec.helmGetHistory('app', 'team-a');

        assert.strictEqual(result.succeeded, true);
        if (result.succeeded) {
            assert.deepStrictEqual(result.result.map((release) => [release.revision, release.appVersion]), [[2, '2.0'], [1, '1.0']]);
        }
        assert.deepStrictEqual(commandArguments(), [['history', '--output', 'json', '--namespace', 'team-a', '--', 'app']]);
    });

    test('accepts captured Helm 4 history with no deployment timestamp and displays an explicit fallback', async () => {
        respondToCommand('[{"revision":1,"status":"failed","chart":"app-1.0.0","app_version":"1.0","description":"Failed before deployment"}]');

        const result = await helmExec.helmGetHistory('app');

        assert.strictEqual(result.succeeded, true);
        if (result.succeeded) {
            assert.strictEqual(result.result[0].updated, '');
            const item = await new HelmHistoryNode('app', result.result[0], 'team-a').getTreeItem();
            assert.strictEqual(item.description, 'failed (deployment time unknown)');
        }
    });

    test('displays the missing-time fallback for Helm 3 empty deployment timestamps', async () => {
        respondToCommand(JSON.stringify([{ ...historyRevision(1), updated: '', status: 'failed' }]));

        const result = await helmExec.helmGetHistory('app');

        assert.strictEqual(result.succeeded, true);
        if (result.succeeded) {
            const item = await new HelmHistoryNode('app', result.result[0]).getTreeItem();
            assert.strictEqual(item.description, 'failed (deployment time unknown)');
        }
    });

    test('returns errors for malformed histories and unsafe response revisions', async () => {
        for (const stdout of [
            'not json', '{}', 'null', '[null]',
            JSON.stringify([{ ...historyRevision(1), revision: '1;$(marker)' }]),
            JSON.stringify([{ ...historyRevision(1), revision: 1.5 }]),
            JSON.stringify([{ ...historyRevision(1), updated: 1 }]),
            JSON.stringify([{ ...historyRevision(1), updated: null }]),
        ]) {
            respondToCommand(stdout);
            const result = await helmExec.helmGetHistory('app');
            assert.strictEqual(result.succeeded, false, stdout);
        }
    });

    test('reports history command failures and rejects invalid targets', async () => {
        respondToCommand('partial output', 7, 'history failed');
        const result = await helmExec.helmGetHistory('app');
        assert.deepStrictEqual(result, { succeeded: false, error: ['Helm fetch history failed: history failed'] });
        sinon.assert.calledOnceWithExactly(error, 'Helm fetch history failed: history failed');

        execute.resetHistory();
        assert.strictEqual((await helmExec.helmGetHistory('--help')).succeeded, false);
        assert.strictEqual((await helmExec.helmGetHistory('app', 'team;$(marker)')).succeeded, false);
        sinon.assert.notCalled(execute);
    });

    test('uninstalls a release only after confirmation using exact argv', async () => {
        const release = 'release;$(marker)&value';
        warning.resolves('Uninstall');

        await helmExec.helmUninstall(new HelmReleaseNode(release, 'deployed', 'team-a'));

        assert.deepStrictEqual(commandArguments(), [['del', '--namespace', 'team-a', '--', release]]);
        sinon.assert.calledOnceWithExactly(warning, `You are about to uninstall ${release}. This action cannot be undone.`, 'Uninstall');
        sinon.assert.calledOnceWithExactly(information, `Release ${release} successfully uninstalled.`);
        sinon.assert.calledOnce(refresh);
        sinon.assert.notCalled(error);
    });

    test('rolls back a release using separate release, revision and cleanup arguments', async () => {
        const release = 'release;$(marker)&value';
        warning.resolves('Rollback');

        await helmExec.helmRollback(new HelmHistoryNode(release, historyRevision(3), 'team-a'));

        assert.deepStrictEqual(commandArguments(), [['rollback', '--cleanup-on-fail', '--namespace', 'team-a', '--', release, '3']]);
        sinon.assert.calledOnceWithExactly(warning, `You are about to rollback ${release} to release version 3. Continue?`, 'Rollback');
        sinon.assert.calledOnceWithExactly(information, `Release ${release} successfully rolled back to 3.`);
        sinon.assert.calledOnce(refresh);
        sinon.assert.notCalled(error);
    });

    test('does not resolve or launch Helm after cancelled confirmations', async () => {
        await helmExec.helmUninstall(new HelmReleaseNode('app', 'deployed', 'team-a'));
        await helmExec.helmRollback(new HelmHistoryNode('app', historyRevision(3), 'team-a'));

        sinon.assert.notCalled(execute);
        sinon.assert.notCalled(helmExecutable.resolveHelmExecutableForExecution as sinon.SinonStub);
        sinon.assert.notCalled(refresh);
    });

    test('does not roll back the currently deployed revision in either Helm status casing', async () => {
        for (const status of ['deployed', 'DEPLOYED']) {
            await helmExec.helmRollback(new HelmHistoryNode('app', { ...historyRevision(3), status }, 'team-a'));
        }
        sinon.assert.notCalled(warning);
        sinon.assert.notCalled(execute);
        assert.strictEqual(information.callCount, 2);
    });

    test('rejects invalid mutation values before confirmation', async () => {
        await helmExec.helmUninstall(new HelmReleaseNode('--help', 'deployed'));
        await helmExec.helmUninstall(new HelmReleaseNode('app', 'deployed', 'team\nother'));
        await helmExec.helmRollback(new HelmHistoryNode('app', { ...historyRevision(1), revision: '1;$(marker)' as unknown as number }));

        sinon.assert.notCalled(warning);
        sinon.assert.notCalled(execute);
        assert.strictEqual(error.callCount, 3);
    });

    test('reports mutation failures without announcing success or refreshing', async () => {
        respondToCommand('partial output', 7, 'mutation failed');
        warning.onFirstCall().resolves('Uninstall');
        warning.onSecondCall().resolves('Rollback');

        await helmExec.helmUninstall(new HelmReleaseNode('app', 'deployed', 'team-a'));
        await helmExec.helmRollback(new HelmHistoryNode('app', historyRevision(3), 'team-a'));

        assert.strictEqual(error.callCount, 2);
        assert.match(error.firstCall.args[0], /mutation failed/);
        assert.match(error.secondCall.args[0], /mutation failed/);
        sinon.assert.notCalled(information);
        sinon.assert.notCalled(refresh);
    });

    test('preserves namespace and revision when opening release documents', async () => {
        const open = sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as vscode.TextDocument);
        sandbox.stub(vscode.window, 'showTextDocument').resolves({} as vscode.TextEditor);

        await helmExec.helmGet(new HelmHistoryNode('app', historyRevision(3), 'team-a'));
        await helmExec.helmGet(new HelmReleaseNode('app', 'deployed', 'team-b'));

        const historical = querystring.parse((open.firstCall.args[0] as vscode.Uri).query);
        const current = querystring.parse((open.secondCall.args[0] as vscode.Uri).query);
        assert.strictEqual(historical.value, 'app');
        assert.strictEqual(historical.revision, '3');
        assert.strictEqual(historical.ns, 'team-a');
        assert.strictEqual(current.revision, undefined);
        assert.strictEqual(current.ns, 'team-b');
    });

    test('carries list namespace through release and history nodes', async () => {
        const kubectl = {} as Kubectl;
        sandbox.stub(kubectlUtils, 'currentNamespace').resolves('team-a');
        sandbox.stub(helmExec, 'helmListAll').resolves({ succeeded: true, result: [{ name: 'app', status: 'deployed', namespace: 'team-a' }] });
        const history = sandbox.stub(helmExec, 'helmGetHistory').resolves({ succeeded: true, result: [historyRevision(3)] });

        const releases = await new HelmReleasesFolder().getChildren(kubectl, host);
        assert.strictEqual(releases.length, 1);
        assert.ok(releases[0] instanceof HelmReleaseNode);
        assert.strictEqual(releases[0].namespace, 'team-a');
        const revisions = await releases[0].getChildren(kubectl, host);
        assert.ok(revisions);
        assert.ok(revisions[0] instanceof HelmHistoryNode);
        assert.strictEqual(revisions[0].namespace, 'team-a');
        sinon.assert.calledOnceWithExactly(history, 'app', 'team-a');
    });

    test('retains the selected namespace when list output omits its namespace field', async () => {
        sandbox.stub(kubectlUtils, 'currentNamespace').resolves('team-a');
        sandbox.stub(helmExec, 'helmListAll').resolves({ succeeded: true, result: [{ name: 'app', status: 'deployed' }] });

        const releases = await new HelmReleasesFolder().getChildren({} as Kubectl, host);

        assert.ok(releases[0] instanceof HelmReleaseNode);
        assert.strictEqual(releases[0].namespace, 'team-a');
    });

    test('uses safe executable resolution for explorer availability checks', async () => {
        (helmExecutable.resolveHelmExecutableForExecution as sinon.SinonStub).resolves(undefined);
        const releases = await new HelmReleasesFolder().getChildren({} as Kubectl, host);
        const revisions = await new HelmReleaseNode('app', 'deployed', 'team-a').getChildren({} as Kubectl, host);

        assert.strictEqual((await releases[0].getTreeItem()).label, 'Helm client is not installed');
        assert.strictEqual((await revisions[0].getTreeItem()).label, 'Helm client is not installed');
        sinon.assert.notCalled(execute);
    });

    test('maps feedback results without executing the display command', async () => {
        respondToCommand('content');
        const success = await helmExec.helmInvokeCommandArgsWithFeedback(['get', 'all', '--', 'app;$(marker)'], 'Loading app...');
        assert.strictEqual(success.resultKind, 'exec-succeeded');
        if (success.resultKind === 'exec-succeeded') {
            assert.strictEqual(success.stdout, 'content');
        }

        respondToCommand('partial output', 7, 'get failed');
        const failure = await helmExec.helmInvokeCommandArgsWithFeedback(['get', 'all', '--', 'app'], 'Loading app...');
        assert.strictEqual(failure.resultKind, 'exec-errored');
        if (failure.resultKind === 'exec-errored') {
            assert.strictEqual(failure.code, 7);
            assert.strictEqual(failure.stderr, 'get failed');
        }
    });

    test('reports process startup failures through the feedback result', async () => {
        execute.rejects(new Error('spawn failed'));

        const result = await helmExec.helmInvokeCommandArgsWithFeedback(['get', 'all', '--', 'app'], 'Loading app...');

        assert.strictEqual(result.resultKind, 'exec-failed');
        sinon.assert.calledOnceWithExactly(error, 'Error: spawn failed');
    });

    for (const release of ['app', 'release&value#fragment;$(printf substituted)%PATH%!COMSPEC!']) {
        test(`passes ${release === 'app' ? 'benign' : 'hostile'} response-derived release values through real native processes`, async () => {
            const observed: { args: readonly string[]; stdout: string }[] = [];
            const script = `
                const args = process.argv.slice(1);
                const release = args[args.indexOf('--') + 1];
                if (args[0] === 'version') {
                    process.stdout.write('v3.19.0');
                } else if (args[0] === 'list') {
                    process.stdout.write(${JSON.stringify(releaseList(release))});
                } else if (args[0] === 'history') {
                    process.stdout.write(JSON.stringify([{ revision: 3, updated: '2026-10-28', status: 'superseded', chart: 'app-1.0', app_version: '1.0', description: release }]));
                } else {
                    process.stdout.write(JSON.stringify(args));
                }
            `;
            execute.callsFake(async (executable: helmExecutable.HelmExecutable, args: readonly string[], commandShell: Shell, useWsl: boolean) => {
                const result = await executeHelmCommand(executable, ['-e', script, '--', ...args], commandShell, useWsl);
                observed.push({ args, stdout: result.stdout });
                return result;
            });

            const listed = await helmExec.helmListAll('team-a');
            assert.strictEqual(listed.succeeded, true);
            if (!listed.succeeded) {
                return;
            }
            assert.strictEqual(listed.result[0].name, release);
            const history = await helmExec.helmGetHistory(listed.result[0].name, 'team-a');
            assert.strictEqual(history.succeeded, true);
            if (history.succeeded) {
                assert.strictEqual(history.result[0].description, release);
            }

            const content = await new KubernetesResourceVirtualFileSystemProvider({} as Kubectl, host)
                .loadResource(helmExec.helmfsUri(release, 3, 'team-a'));
            assert.deepStrictEqual(JSON.parse(content), ['get', 'all', '--revision', '3', '--namespace', 'team-a', '--', release]);
            warning.onFirstCall().resolves('Uninstall');
            warning.onSecondCall().resolves('Rollback');
            await helmExec.helmUninstall(new HelmReleaseNode(release, 'deployed', 'team-a'));
            await helmExec.helmRollback(new HelmHistoryNode(release, historyRevision(3), 'team-a'));
            const forwarded = observed.filter((call) => ['get', 'del', 'rollback'].includes(call.args[0]));
            assert.strictEqual(forwarded.length, 3);
            for (const call of forwarded) {
                assert.deepStrictEqual(JSON.parse(call.stdout), call.args);
            }
            sinon.assert.notCalled(error);
        });
    }

    function respondToCommand(stdout: string, code = 0, stderr = ''): void {
        execute.callsFake(async (_executable: helmExecutable.HelmExecutable, args: readonly string[]) => {
            if (args[0] === 'version') {
                return { code: args.includes('-c') ? 1 : 0, stdout: 'v3.19.0', stderr: '' };
            }
            return { code, stdout, stderr };
        });
    }

    function commandArguments(): readonly string[][] {
        return execute.getCalls().map((call) => call.args[1] as string[]).filter((args) => args[0] !== 'version');
    }
});

suite('Helm release virtual documents', () => {
    let sandbox: sinon.SinonSandbox;
    let syntaxVersion: sinon.SinonStub;
    let invoke: sinon.SinonStub;
    let showErrorMessage: sinon.SinonStub;
    let provider: KubernetesResourceVirtualFileSystemProvider;

    setup(() => {
        sandbox = sinon.createSandbox();
        syntaxVersion = sandbox.stub(helmExec, 'helmSyntaxVersion').resolves(helmExec.HelmSyntaxVersion.V3);
        invoke = sandbox.stub(helmExec, 'helmInvokeCommandArgsWithFeedback').resolves({
            resultKind: 'exec-succeeded',
            execProgram: { binBaseName: 'helm', configKeyName: 'helm', displayName: 'Helm', offersInstall: true },
            command: '', stdout: 'release content',
        });
        sandbox.stub(helmExec, 'helmInvokeCommandWithFeedback').rejects(new Error('Legacy Helm execution is not allowed.'));
        showErrorMessage = sinon.stub().resolves(undefined);
        provider = new KubernetesResourceVirtualFileSystemProvider({} as Kubectl, { showErrorMessage } as unknown as Host);
    });

    teardown(() => sandbox.restore());

    for (const version of [helmExec.HelmSyntaxVersion.V2, helmExec.HelmSyntaxVersion.V3, helmExec.HelmSyntaxVersion.V4]) {
        test(`loads an encoded release URI with Helm ${version} syntax`, async () => {
            const release = 'release &ns=other#fragment%25;$(marker)';
            syntaxVersion.resolves(version);

            const content = await provider.loadResource(helmExec.helmfsUri(release, 3, 'team-a'));

            assert.strictEqual(content, 'release content');
            sinon.assert.calledOnceWithExactly(invoke, [
                'get', ...(version === helmExec.HelmSyntaxVersion.V2 ? [] : ['all']), '--revision', '3',
                ...(version === helmExec.HelmSyntaxVersion.V2 ? [] : ['--namespace', 'team-a']), '--', release,
            ], `Loading ${release}...`);
        });
    }

    test('preserves revision zero without inventing a namespace', async () => {
        await provider.loadResource(helmExec.helmfsUri('app', 0));

        sinon.assert.calledOnceWithExactly(invoke, ['get', 'all', '--revision', '0', '--', 'app'], 'Loading app...');
    });

    test('rejects invalid release URI fields before version discovery or execution', async () => {
        for (const query of [
            'value=--help',
            'value=app%00name',
            'value=app%0Aname',
            `value=${'a'.repeat(254)}`,
            'value=app&value=other',
            'value=app&revision=1&revision=2',
            'value=app&ns=team-a&ns=team-b',
            'value=app&ns=team%3B%24(marker)',
            'value=app&revision=',
            'value=app&revision=-1',
            'value=app&revision=1.5',
            'value=app&revision=01',
            'value=app&revision=1e2',
            'value=app&revision=1%3B%24(marker)',
            'value=app&revision=9007199254740992',
            `value=app&revision=1&${'x=&'.repeat(999)}revision=2`,
            `value=app&padding=${'x'.repeat(9000)}`,
        ]) {
            await assert.rejects(() => provider.loadResource(vscode.Uri.from({
                scheme: K8S_RESOURCE_SCHEME,
                authority: HELM_RESOURCE_AUTHORITY,
                path: '/release.txt',
                query,
            })), query);
        }

        sinon.assert.notCalled(syntaxVersion);
        sinon.assert.notCalled(invoke);
    });

    test('reports failed release reads through the existing virtual-filesystem error path', async () => {
        invoke.resolves({ resultKind: 'exec-errored', execProgram: { displayName: 'Helm' }, command: 'display only', code: 7, stderr: 'get failed' });

        await assert.rejects(() => provider.loadResource(helmExec.helmfsUri('app', undefined)));

        sinon.assert.calledOnceWithExactly(showErrorMessage, 'Get command failed: get failed');
    });

    test('keeps a YAML release label as data through link creation and document loading', async () => {
        const release = 'release&ns=other#fragment;$(marker)';
        const text = `apiVersion: v1\nkind: Pod\nmetadata:\n  labels:\n    release: ${release}\n`;
        const document = {
            uri: kubefsUri('team-a', 'pods/app', 'yaml'),
            version: 1,
            getText: () => text,
            positionAt: (offset: number) => {
                const lines = text.substring(0, offset).split('\n');
                return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
            },
        } as vscode.TextDocument;

        const links = await Promise.resolve(new KubernetesResourceLinkProvider().provideDocumentLinks(document, {} as vscode.CancellationToken));
        assert.ok(links);
        const link = links.find((candidate) => candidate.target?.authority === HELM_RESOURCE_AUTHORITY);
        assert.ok(link?.target);
        const query = querystring.parse(link.target.query);
        assert.strictEqual(query.value, release);
        assert.strictEqual(query.ns, 'team-a');
        assert.strictEqual(link.target.fragment, '');
        assert.strictEqual(await provider.loadResource(link.target), 'release content');
        sinon.assert.calledOnceWithExactly(invoke, ['get', 'all', '--namespace', 'team-a', '--', release], `Loading ${release}...`);
    });
});

function releaseList(name: string, namespace = 'team-a'): string {
    return JSON.stringify([{
        name, namespace, revision: '1', updated: '2026-10-28T10:00:00Z', status: 'deployed',
        chart: 'app-1.0.0', app_version: '1.0',
    }]);
}

function helm2ReleaseList(name: string | undefined, next = '', namespace = 'team-a'): string {
    return JSON.stringify({
        Next: next,
        Releases: name === undefined ? [] : [{
            Name: name, Revision: 1, Updated: 'Wed Oct 28 10:00:00 2026', Status: 'DEPLOYED',
            Chart: 'app-1.0.0', AppVersion: '1.0', Namespace: namespace,
        }],
    });
}

function historyRevision(revision: number): helmExec.HelmRelease {
    return { revision, updated: '2026-10-28', status: 'superseded', chart: 'app-1.0', appVersion: '', description: 'Installed' };
}
