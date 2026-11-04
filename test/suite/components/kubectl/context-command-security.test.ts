import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ExecBinNotFound, ExecResult } from '../../../../src/binutilplusplus';
import { kubeChannel } from '../../../../src/kubeChannel';
import { Kubectl } from '../../../../src/kubectl';
import { deleteCluster, getContexts, KubectlContext, setCurrentContext } from '../../../../src/kubectlUtils';

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

function failure(): ExecResult {
    return { resultKind: 'exec-errored', execProgram: binary, command: 'test', code: 1, stderr: 'denied' };
}

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

    function fakeKubectl() {
        const invoke = sandbox.stub().resolves(success());
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
            [['config', 'unset', '--', `users.${context.userName}`], 'Deleting user...'],
            [['config', 'delete-context', '--', context.contextName], 'Deleting context...'],
        ]);
        sinon.assert.notCalled(fixture.legacy);
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

        assert.strictEqual(await deleteCluster(fixture.kubectl, context), true);

        sinon.assert.calledThrice(fixture.invokeWithFeedback);
        sinon.assert.calledOnce(vscode.window.showWarningMessage as sinon.SinonStub);
        sinon.assert.calledOnce(vscode.window.showInformationMessage as sinon.SinonStub);
    });

    test('reports a context-removal failure instead of announcing success', async () => {
        const fixture = fakeKubectl();
        fixture.invokeWithFeedback.onThirdCall().resolves(failure());

        assert.strictEqual(await deleteCluster(fixture.kubectl, context), false);

        sinon.assert.calledOnce(vscode.window.showErrorMessage as sinon.SinonStub);
        sinon.assert.notCalled(vscode.window.showInformationMessage as sinon.SinonStub);
    });
});
