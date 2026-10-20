import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as config from '../../src/components/config/config';
import * as fileCommands from '../../src/components/kubectl/file-commands';
import { Kubectl } from '../../src/kubectl';
import { applyResourceFromUri } from '../../src/kubectlUtils';

suite('Kubectl file URI security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => sandbox.restore());

    test('does not override a manifest namespace for URI operations', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(config, 'getConfiguredNamespace').returns('configured-team');
        sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
        const invokeCommandArgs = sinon.stub().resolves({ resultKind: 'exec-succeeded', stdout: 'applied' });
        const kubectl = { invokeCommandArgs } as unknown as Kubectl;
        const uri = vscode.Uri.file('/tmp/team manifest.yaml');

        await applyResourceFromUri(uri, kubectl);

        sinon.assert.calledOnceWithExactly(invokeCommandArgs, ['apply', '-f', uri.fsPath]);
        assert.ok(!invokeCommandArgs.firstCall.args[0].includes('--namespace'));
    });

    test('reports WSL conversion failure without invoking kubectl', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        sandbox.stub(fileCommands, 'hostPathToWsl').rejects(new Error('Unable to convert the Windows path for WSL.'));
        const showErrorMessage = sandbox.stub(vscode.window, 'showErrorMessage') as sinon.SinonStub;
        showErrorMessage.resolves(undefined);
        const invokeCommandArgs = sinon.stub();
        const kubectl = { invokeCommandArgs } as unknown as Kubectl;

        await applyResourceFromUri(vscode.Uri.file('C:\\work dir\\manifest.yaml'), kubectl);

        sinon.assert.notCalled(invokeCommandArgs);
        sinon.assert.calledOnceWithExactly(
            showErrorMessage,
            'Error applying resource: Unable to convert the Windows path for WSL.'
        );
    });
});
