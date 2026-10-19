import * as assert from 'assert';
import * as sinon from 'sinon';
import { host } from '../../../../src/host';
import { Kubectl } from '../../../../src/kubectl';
import { portForwardToResource, promptForPort } from '../../../../src/components/kubectl/port-forward';
import { INVALID_KUBERNETES_IDENTIFIER_MESSAGE } from '../../../../src/utils/kubernetes-identifiers';

suite('Port-forward security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => sandbox.restore());

    test('rejects a hostile resource before lookup or port prompt', async () => {
        const invokeCommand = sinon.stub();
        const kubectl = { invokeCommand } as unknown as Kubectl;
        const showInputBox = sandbox.stub(host, 'showInputBox');
        const showErrorMessage = sandbox.stub(host, 'showErrorMessage').resolves(undefined);

        const mappings = await promptForPort(kubectl, 'pods', 'api; marker', 'team-a');

        assert.deepStrictEqual(mappings, []);
        sinon.assert.notCalled(invokeCommand);
        sinon.assert.notCalled(showInputBox);
        sinon.assert.calledOnceWithExactly(showErrorMessage, INVALID_KUBERNETES_IDENTIFIER_MESSAGE);
    });

    test('keeps lookup values as distinct arguments before cancellation', async () => {
        const invokeCommand = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: JSON.stringify({
                metadata: { name: 'api-0', namespace: 'team-a' },
                spec: { containers: [{ name: 'app', ports: [{ name: 'http', containerPort: 8080 }] }] },
            }),
        });
        const kubectl = { invokeCommand } as unknown as Kubectl;
        const showInputBox = sandbox.stub(host, 'showInputBox').resolves(undefined);

        const mappings = await promptForPort(kubectl, 'pods', 'api-0', 'team-a');

        assert.deepStrictEqual(mappings, []);
        sinon.assert.calledOnceWithExactly(invokeCommand, [
            'get', 'pods', 'api-0', '--namespace', 'team-a', '-o', 'json'
        ]);
        sinon.assert.calledOnce(showInputBox);
        assert.strictEqual(showInputBox.firstCall.args[0].value, '8080:http');
    });

    test('offers an unnamed numeric container port', async () => {
        const invokeCommand = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: JSON.stringify({
                metadata: { name: 'api-0', namespace: 'team-a' },
                spec: { containers: [{ name: 'app', ports: [{ containerPort: 9090 }] }] },
            }),
        });
        const kubectl = { invokeCommand } as unknown as Kubectl;
        const showInputBox = sandbox.stub(host, 'showInputBox').resolves(undefined);

        await promptForPort(kubectl, 'pods', 'api-0', 'team-a');

        sinon.assert.calledOnce(showInputBox);
        assert.strictEqual(showInputBox.firstCall.args[0].value, '9090:9090');
    });

    test('launches a direct terminal with exact port-forward arguments', async () => {
        const invokeInNewTerminal = sinon.stub().resolves({ dispose: () => {} });
        const kubectl = { invokeInNewTerminal } as unknown as Kubectl;
        sandbox.stub(host, 'showInformationMessage').resolves(undefined);

        const ports = await portForwardToResource(
            kubectl,
            'pods',
            'api-0',
            [{ localPort: 18080, targetPort: 8080 }],
            'team-a'
        );

        assert.deepStrictEqual(ports, [18080]);
        sinon.assert.calledOnce(invokeInNewTerminal);
        assert.deepStrictEqual(invokeInNewTerminal.firstCall.args[0], [
            'port-forward', 'pods/api-0', '18080:8080', '-n', 'team-a'
        ]);
        assert.strictEqual(invokeInNewTerminal.firstCall.args[1], 'kubectl port-forward');
        assert.strictEqual(invokeInNewTerminal.firstCall.args[2], undefined);
        assert.strictEqual(invokeInNewTerminal.firstCall.args[3].id, 'plug');
    });
});
