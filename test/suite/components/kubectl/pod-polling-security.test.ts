import * as assert from 'assert';
import * as sinon from 'sinon';
import { Kubectl } from '../../../../src/kubectl';
import { waitForRunningPod } from '../../../../src/kubectlUtils';

suite('Pod polling security', () => {
    let clock: sinon.SinonFakeTimers;

    setup(() => {
        clock = sinon.useFakeTimers();
    });

    teardown(() => clock.restore());

    test('keeps a hostile pod name out of execution', async () => {
        const invokeCommand = sinon.stub();
        const kubectl = { invokeCommand } as unknown as Kubectl;

        await assert.rejects(waitForRunningPod(kubectl, 'api; marker'), /invalid identifier/i);

        sinon.assert.notCalled(invokeCommand);
    });

    test('polls with one resource argument until the pod is running', async () => {
        const invokeCommand = sinon.stub();
        invokeCommand.onFirstCall().resolves({
            resultKind: 'exec-succeeded',
            stdout: 'api-0 1/1 Pending 0 1s',
        });
        invokeCommand.onSecondCall().resolves({
            resultKind: 'exec-succeeded',
            stdout: 'api-0 1/1 Running 0 2s',
        });
        const kubectl = { invokeCommand } as unknown as Kubectl;

        const polling = waitForRunningPod(kubectl, 'api-0');
        await clock.tickAsync(1000);
        await polling;

        assert.strictEqual(invokeCommand.callCount, 2);
        sinon.assert.alwaysCalledWithExactly(invokeCommand, ['get', 'pod/api-0', '--no-headers']);
    });
});
