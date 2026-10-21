import * as assert from 'assert';
import * as sinon from 'sinon';
import { host } from '../../../../src/host';
import { Kubectl } from '../../../../src/kubectl';
import { portForwardToResource, promptForPort, validPortForwardPodNames } from '../../../../src/components/kubectl/port-forward';

suite('Port-forward security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => sandbox.restore());

    test('rejects an invalid selected resource before lookup and prompt', async () => {
        const invokeCommandArgs = sinon.stub();
        const kubectl = { invokeCommandArgs } as unknown as Kubectl;
        const showInputBox = sandbox.stub(host, 'showInputBox');
        sandbox.stub(host, 'showErrorMessage').resolves(undefined);

        const mappings = await promptForPort(kubectl, 'pods', 'api/name', 'team-a');

        assert.deepStrictEqual(mappings, []);
        sinon.assert.notCalled(invokeCommandArgs);
        sinon.assert.notCalled(showInputBox);
    });

    test('lookup keeps the resource target and namespace as arguments before cancellation', async () => {
        const invokeCommandArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: JSON.stringify({
                spec: { containers: [{ name: 'app', ports: [{ name: 'http', containerPort: 8080 }] }] },
            }),
        });
        const kubectl = { invokeCommandArgs } as unknown as Kubectl;
        const showInputBox = sandbox.stub(host, 'showInputBox').resolves(undefined);

        const mappings = await promptForPort(kubectl, 'pods', 'api;$(marker)', 'team-a');

        assert.deepStrictEqual(mappings, []);
        sinon.assert.calledOnceWithExactly(invokeCommandArgs, [
            'get', 'pods/api;$(marker)', '--namespace', 'team-a', '-o', 'json'
        ]);
        sinon.assert.calledOnce(showInputBox);
    });

    test('launches a direct terminal with exact arguments', async () => {
        const invokeArgsInNewTerminal = sinon.stub().resolves({ dispose: () => {} });
        const kubectl = { invokeArgsInNewTerminal } as unknown as Kubectl;
        sandbox.stub(host, 'showInformationMessage').resolves(undefined);

        const ports = await portForwardToResource(
            kubectl,
            'pods',
            'api-0',
            [{ localPort: 18080, targetPort: 8080 }],
            'team-a'
        );

        assert.deepStrictEqual(ports, [18080]);
        assert.deepStrictEqual(invokeArgsInNewTerminal.firstCall.args[0], [
            'port-forward', 'pods/api-0', '18080:8080', '-n', 'team-a'
        ]);
        assert.strictEqual(invokeArgsInNewTerminal.firstCall.args[1], 'kubectl port-forward');
        assert.strictEqual(invokeArgsInNewTerminal.firstCall.args[3].id, 'plug');
    });

    test('reports a failed port-forward terminal exit', async () => {
        let onClose: ((terminal: any) => void) | undefined;
        const invokeArgsInNewTerminal = sinon.stub().callsFake(async (_args, _name, callback) => {
            onClose = callback;
            return { dispose: () => {} };
        });
        const kubectl = { invokeArgsInNewTerminal } as unknown as Kubectl;
        const showErrorMessage = sandbox.stub(host, 'showErrorMessage').resolves(undefined);
        sandbox.stub(host, 'showInformationMessage').resolves(undefined);

        await portForwardToResource(kubectl, 'pods', 'api-0', [{ localPort: 18080, targetPort: 8080 }], 'team-a');
        onClose!({ exitStatus: { code: 1 } });

        sinon.assert.calledOnceWithExactly(
            showErrorMessage,
            'kubectl port-forward failed with exit code 1. The selected local port may already be in use.'
        );
    });

    test('skips invalid pod names while retaining valid choices', () => {
        assert.deepStrictEqual(validPortForwardPodNames([
            { metadata: { name: 'bad/name' } },
            { metadata: { name: 'api-0' } },
            { metadata: {} },
        ] as any), ['api-0']);
    });
});
