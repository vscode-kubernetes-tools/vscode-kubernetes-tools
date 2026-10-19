import * as assert from 'assert';
import * as sinon from 'sinon';
import { Kubectl } from '../../../src/kubectl';
import { suggestedShellForContainer } from '../../../src/utils/container-shell';

suite('Container shell detection', () => {
    test('passes pod, namespace, and container as separate arguments', async () => {
        const invokeCommand = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: '',
        });
        const kubectl = { invokeCommand } as unknown as Kubectl;

        const shell = await suggestedShellForContainer(kubectl, 'api-0', 'team-a', 'app');

        assert.strictEqual(shell, 'bash');
        sinon.assert.calledOnceWithExactly(invokeCommand, [
            'exec', 'api-0', '--namespace', 'team-a', '-c', 'app',
            '--', 'ls', '-la', '/bin/bash'
        ]);
    });

    test('falls back to sh without optional arguments', async () => {
        const invokeCommand = sinon.stub().resolves({
            resultKind: 'exec-errored',
            code: 1,
            stderr: 'not found',
        });
        const kubectl = { invokeCommand } as unknown as Kubectl;

        const shell = await suggestedShellForContainer(kubectl, 'api-0', undefined, undefined);

        assert.strictEqual(shell, 'sh');
        sinon.assert.calledOnceWithExactly(invokeCommand, [
            'exec', 'api-0', '--', 'ls', '-la', '/bin/bash'
        ]);
    });
});
