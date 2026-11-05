import * as assert from 'assert';
import * as nativeFs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { findBinaryPath } from '../../../../src/binutil';
import { ExecBinNotFound, ExecResult } from '../../../../src/binutilplusplus';
import * as config from '../../../../src/components/config/config';
import { fs } from '../../../../src/fs';
import { host } from '../../../../src/host';
import { kubeChannel } from '../../../../src/kubeChannel';
import { createOnBinary, Kubectl } from '../../../../src/kubectl';
import { deleteCluster, getContexts, KubectlContext, setCurrentContext } from '../../../../src/kubectlUtils';
import { shell } from '../../../../src/shell';

const binary = { binBaseName: 'kubectl', configKeyName: 'kubectl', displayName: 'Kubectl', offersInstall: true };
const context: KubectlContext = {
    contextName: 'team "two";$(marker)&%NAME%',
    clusterName: '--cluster "two";$(marker)',
    userName: 'user.name "two";$(marker)',
    active: false,
    provider: '',
};

function success(stdout = ''): ExecResult {
    return { resultKind: 'exec-succeeded', execProgram: binary, command: 'test', stdout };
}

function failure(stderr = 'denied'): ExecResult {
    return { resultKind: 'exec-errored', execProgram: binary, command: 'test', code: 1, stderr };
}

const unsupportedDeleteUser = 'error: unknown command "delete-user" for "kubectl config"\n';

suite('Kubeconfig context command security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(kubeChannel, 'showOutput');
        sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);
        sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
        sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    });
    teardown(() => sandbox.restore());

    function fakeKubectl(clientMinor = '35') {
        const invoke = sandbox.stub().resolves(success(JSON.stringify({ clientVersion: { major: '1', minor: clientMinor } })));
        const invokeWithFeedback = sandbox.stub().resolves(success());
        const promptInstallDependencies = sandbox.stub().resolves();
        const reportFailure = sandbox.stub().resolves();
        const legacy = sandbox.stub().rejects(new Error('Context operations must not use the shell-string lane.'));
        const kubectl = {
            invokeCommandArgs: invoke,
            invokeCommandArgsWithFeedback: invokeWithFeedback,
            invokeCommand: legacy,
            invokeCommandWithFeedback: legacy,
            readJSON: legacy,
            promptInstallDependencies,
            reportFailure,
        } as unknown as Kubectl;
        return { kubectl, invoke, invokeWithFeedback, promptInstallDependencies, reportFailure, legacy };
    }

    test('reads context identities without interpreting punctuation or whitespace', async () => {
        const fixture = fakeKubectl();
        fixture.invoke.resolves(success(JSON.stringify({
            'current-context': context.contextName,
            clusters: [{ name: context.clusterName, cluster: { server: 'https://api.example.invalid' } }],
            contexts: [{ name: context.contextName, context: { cluster: context.clusterName, user: context.userName } }],
        })));

        assert.deepStrictEqual(await getContexts(fixture.kubectl, { silent: false }), [{ ...context, active: true }]);

        sinon.assert.calledOnceWithExactly(fixture.invoke, ['config', 'view', '-o', 'json']);
        sinon.assert.notCalled(fixture.legacy);
    });

    test('reports context discovery failures without parsing them as configuration', async () => {
        const fixture = fakeKubectl();
        const result = failure();
        fixture.invoke.resolves(result);

        assert.deepStrictEqual(await getContexts(fixture.kubectl, { silent: false }), []);

        sinon.assert.calledOnceWithExactly(fixture.reportFailure, result, {});
    });

    test('switches to an opaque, option-like context and preserves the command result', async () => {
        const fixture = fakeKubectl();
        const result = failure();
        fixture.invoke.resolves(result);
        const name = `--${context.contextName}`;

        assert.strictEqual(await setCurrentContext(fixture.kubectl, name), result);

        sinon.assert.calledOnceWithExactly(fixture.invoke, ['config', 'use-context', '--', name]);
        sinon.assert.notCalled(fixture.legacy);
    });

    test('cleans up cluster, user and context with literal arguments in the existing order', async () => {
        const fixture = fakeKubectl();

        assert.strictEqual(await deleteCluster(fixture.kubectl, context), true);

        assert.deepStrictEqual(fixture.invokeWithFeedback.args, [
            [['config', 'delete-cluster', '--', context.clusterName], 'Deleting cluster...'],
            [['config', 'delete-user', '--', context.userName], 'Deleting user...'],
            [['config', 'delete-context', '--', context.contextName], 'Deleting context...'],
        ]);
        sinon.assert.notCalled(fixture.legacy);
    });

    test('retains older-client cleanup only for unambiguous dot-free user names', async () => {
        const fixture = fakeKubectl('19');
        fixture.invokeWithFeedback.onSecondCall().resolves(failure(unsupportedDeleteUser));
        const simpleContext = { ...context, userName: '--user "two";$(marker)' };

        assert.strictEqual(await deleteCluster(fixture.kubectl, simpleContext), true);

        assert.deepStrictEqual(fixture.invokeWithFeedback.args, [
            [['config', 'delete-cluster', '--', simpleContext.clusterName], 'Deleting cluster...'],
            [['config', 'delete-user', '--', simpleContext.userName], 'Deleting user...'],
            [['config', 'unset', '--', `users.${simpleContext.userName}`], 'Deleting user...'],
            [['config', 'delete-context', '--', simpleContext.contextName], 'Deleting context...'],
        ]);
        sinon.assert.calledOnceWithExactly(fixture.invoke, ['version', '--client=true', '-o', 'json']);
        sinon.assert.notCalled(vscode.window.showWarningMessage as sinon.SinonStub);
    });

    test('never retries a dotted user through property-path parsing on older clients', async () => {
        const fixture = fakeKubectl('19');
        fixture.invokeWithFeedback.onSecondCall().resolves(failure(unsupportedDeleteUser));
        const dottedContext = { ...context, userName: 'victim.token' };

        assert.strictEqual(await deleteCluster(fixture.kubectl, dottedContext), true);

        assert.deepStrictEqual(fixture.invokeWithFeedback.args, [
            [['config', 'delete-cluster', '--', dottedContext.clusterName], 'Deleting cluster...'],
            [['config', 'delete-user', '--', dottedContext.userName], 'Deleting user...'],
            [['config', 'delete-context', '--', dottedContext.contextName], 'Deleting context...'],
        ]);
        sinon.assert.calledOnceWithExactly(vscode.window.showWarningMessage as sinon.SinonStub,
            `Failed to remove the underlying user for context ${dottedContext.contextName}. Upgrade kubectl to 1.20 or later to delete user names containing dots. See Output window for more details.`);
        sinon.assert.calledOnceWithExactly(vscode.window.showInformationMessage as sinon.SinonStub,
            `Deleted context '${dottedContext.contextName}', but some associated data could not be removed. See Output window for more details.`);
    });

    test('does not enable the older-client fallback when the version cannot be read', async () => {
        const fixture = fakeKubectl();
        fixture.invokeWithFeedback.onSecondCall().resolves(failure(unsupportedDeleteUser));
        fixture.invoke.resolves(success('not JSON'));
        const simpleContext = { ...context, userName: 'victim' };

        assert.strictEqual(await deleteCluster(fixture.kubectl, simpleContext), true);

        sinon.assert.calledThrice(fixture.invokeWithFeedback);
        assert.deepStrictEqual(fixture.invokeWithFeedback.secondCall.args[0], ['config', 'delete-user', '--', simpleContext.userName]);
        sinon.assert.calledOnce(vscode.window.showWarningMessage as sinon.SinonStub);
    });

    test('skips user removal for a context without a user', async () => {
        const fixture = fakeKubectl();
        const anonymousContext = { ...context, userName: '' };

        assert.strictEqual(await deleteCluster(fixture.kubectl, anonymousContext), true);

        assert.deepStrictEqual(fixture.invokeWithFeedback.args, [
            [['config', 'delete-cluster', '--', anonymousContext.clusterName], 'Deleting cluster...'],
            [['config', 'delete-context', '--', anonymousContext.contextName], 'Deleting context...'],
        ]);
    });

    test('stops cleanup and offers installation when kubectl is unavailable', async () => {
        const fixture = fakeKubectl();
        const missing: ExecBinNotFound = {
            resultKind: 'exec-bin-not-found', execProgram: binary, command: 'test',
            findResult: { found: false, how: 'path' },
        };
        fixture.invokeWithFeedback.resolves(missing);

        assert.strictEqual(await deleteCluster(fixture.kubectl, context), false);

        sinon.assert.calledOnce(fixture.invokeWithFeedback);
        sinon.assert.calledOnceWithExactly(
            fixture.promptInstallDependencies, missing, `Can't delete ${context.contextName}): kubectl not found`
        );
        sinon.assert.notCalled(vscode.window.showInformationMessage as sinon.SinonStub);
    });

    test('keeps warning and context cleanup behavior after a user-removal failure', async () => {
        const fixture = fakeKubectl();
        fixture.invokeWithFeedback.onSecondCall().resolves(failure());
        const simpleContext = { ...context, userName: 'victim' };

        assert.strictEqual(await deleteCluster(fixture.kubectl, simpleContext), true);

        assert.deepStrictEqual(fixture.invokeWithFeedback.args, [
            [['config', 'delete-cluster', '--', simpleContext.clusterName], 'Deleting cluster...'],
            [['config', 'delete-user', '--', simpleContext.userName], 'Deleting user...'],
            [['config', 'delete-context', '--', simpleContext.contextName], 'Deleting context...'],
        ]);
        sinon.assert.calledOnce(vscode.window.showWarningMessage as sinon.SinonStub);
        sinon.assert.calledOnceWithExactly(vscode.window.showInformationMessage as sinon.SinonStub,
            `Deleted context '${simpleContext.contextName}', but some associated data could not be removed. See Output window for more details.`);
    });

    test('reports a context-removal failure instead of announcing success', async () => {
        const fixture = fakeKubectl();
        fixture.invokeWithFeedback.onThirdCall().resolves(failure());

        assert.strictEqual(await deleteCluster(fixture.kubectl, context), false);

        sinon.assert.calledOnce(vscode.window.showErrorMessage as sinon.SinonStub);
        sinon.assert.notCalled(vscode.window.showInformationMessage as sinon.SinonStub);
    });

    test('native cleanup preserves victim credentials when deleting victim.token', async function () {
        this.timeout(15000);
        const executable = process.env.TEST_KUBECTL_PATH || await findBinaryPath(shell, 'kubectl');
        if (!executable) { this.skip(); }
        const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'kubeconfig-delete-user-'));
        const configPath = path.join(directory, 'config.json');
        nativeFs.writeFileSync(configPath, JSON.stringify({
            apiVersion: 'v1', kind: 'Config', 'current-context': 'selected',
            clusters: [
                { name: 'selected', cluster: { server: 'https://selected.invalid' } },
                { name: 'retained', cluster: { server: 'https://retained.invalid' } },
            ],
            contexts: [
                { name: 'selected', context: { cluster: 'selected', user: 'victim.token' } },
                { name: 'retained', context: { cluster: 'retained', user: 'victim' } },
            ],
            users: [
                { name: 'victim', user: { token: 'synthetic-keep' } },
                { name: 'victim.token', user: { token: 'synthetic-delete' } },
            ],
        }));
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(config, 'getEnableSnapFlag').returns(false);
        sandbox.stub(shell, 'execOpts').returns({ cwd: directory, env: { ...process.env, KUBECONFIG: configPath } });
        sandbox.stub(host, 'longRunning').callsFake((_options, action) => action());
        const kubectl = createOnBinary(host, fs, shell, executable);
        try {
            const version = await kubectl.invokeCommandArgs(['version', '--client=true', '-o', 'json']);
            if (ExecResult.failed(version)) { assert.fail(ExecResult.failureMessage(version, {})); }
            const { major, minor } = JSON.parse(version.stdout).clientVersion;
            const supportsDeleteUser = Number(major) > 1 || Number.parseInt(minor) >= 20;
            const selected = (await getContexts(kubectl, {})).find((c) => c.contextName === 'selected')!;

            assert.strictEqual(await deleteCluster(kubectl, selected), true);

            const result = await kubectl.invokeCommandArgs(['config', 'view', '--raw', '-o', 'json']);
            if (ExecResult.failed(result)) { assert.fail(ExecResult.failureMessage(result, {})); }
            const remaining = JSON.parse(result.stdout);
            assert.deepStrictEqual(remaining.clusters, [
                { name: 'retained', cluster: { server: 'https://retained.invalid' } },
            ]);
            assert.deepStrictEqual(remaining.contexts, [
                { name: 'retained', context: { cluster: 'retained', user: 'victim' } },
            ]);
            assert.deepStrictEqual(remaining.users, [
                { name: 'victim', user: { token: 'synthetic-keep' } },
                ...(supportsDeleteUser ? [] : [{ name: 'victim.token', user: { token: 'synthetic-delete' } }]),
            ]);
            if (supportsDeleteUser) {
                sinon.assert.notCalled(vscode.window.showWarningMessage as sinon.SinonStub);
            } else {
                sinon.assert.calledOnce(vscode.window.showWarningMessage as sinon.SinonStub);
            }
        } finally {
            kubectl.dispose();
            nativeFs.rmSync(directory, { recursive: true, force: true });
        }
    });
});
