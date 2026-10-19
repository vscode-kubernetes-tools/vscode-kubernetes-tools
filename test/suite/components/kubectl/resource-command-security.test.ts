import * as assert from 'assert';
import * as sinon from 'sinon';
import { Kubectl } from '../../../../src/kubectl';
import {
    deleteResourceWithConfirmation,
    execResourceArgs,
    getResourceArgs,
    restartResourceArgs,
    scaleResourceArgs,
} from '../../../../src/components/kubectl/resource-commands';

suite('Resource command security', () => {
    test('builds Get, Exec, Scale, and restart arguments without local shell text', () => {
        const hostile = 'value; $(marker) & %PATH% !COMSPEC!';
        assert.deepStrictEqual(getResourceArgs(`pods/${hostile}`, 'team-a'), [
            'get', `pods/${hostile}`, '--namespace', 'team-a', '-o', 'wide'
        ]);
        assert.deepStrictEqual(execResourceArgs('api-0', 'app', '/bin/sh', hostile), [
            'exec', 'api-0', '-c', 'app', '--', '/bin/sh', '-c', hostile
        ]);
        assert.deepStrictEqual(scaleResourceArgs(`deployment/${hostile}`, 3), [
            'scale', '--replicas=3', `deployment/${hostile}`
        ]);
        assert.deepStrictEqual(restartResourceArgs(`deployment/${hostile}`, ['--namespace', 'team-a']), [
            'rollout', 'restart', `deployment/${hostile}`, '--namespace', 'team-a'
        ]);
    });

    test('Delete cancellation prevents execution', async () => {
        const invokeCommandWithFeedback = sinon.stub();
        const report = sinon.stub();
        const kubectl = { invokeCommandWithFeedback } as unknown as Kubectl;

        const executed = await deleteResourceWithConfirmation({
            kubectl,
            resource: 'deployment/api',
            namespace: 'team-a',
            now: false,
            confirm: async () => false,
            report,
        });

        assert.strictEqual(executed, false);
        sinon.assert.notCalled(invokeCommandWithFeedback);
        sinon.assert.notCalled(report);
    });

    test('Delete acceptance executes exact arguments and keeps display text separate', async () => {
        const result = { resultKind: 'exec-succeeded', stdout: 'deleted' } as const;
        const invokeCommandWithFeedback = sinon.stub().resolves(result);
        const report = sinon.stub().resolves();
        const kubectl = { invokeCommandWithFeedback } as unknown as Kubectl;

        const executed = await deleteResourceWithConfirmation({
            kubectl,
            resource: 'deployment/api',
            namespace: 'team-a',
            now: true,
            confirm: async () => true,
            report,
        });

        assert.strictEqual(executed, true);
        sinon.assert.calledOnceWithExactly(
            invokeCommandWithFeedback,
            ['delete', 'deployment/api', '--namespace', 'team-a', '--now'],
            'Deleting deployment/api...'
        );
        sinon.assert.calledOnceWithExactly(report, result);
    });
});
