import * as assert from 'assert';
import * as sinon from 'sinon';
import { Kubectl } from '../../../../src/kubectl';
import {
    deleteResourceWithConfirmation,
    listNamespaceResources,
    normaliseResourceTarget,
} from '../../../../src/components/kubectl/resource-commands';

suite('Resource command security', () => {
    test('normalises supported resource input without splitting arbitrary text', () => {
        assert.strictEqual(normaliseResourceTarget('deployment api', false), 'deployment/api');
        assert.strictEqual(normaliseResourceTarget('deployment/api', false), 'deployment/api');
        assert.strictEqual(normaliseResourceTarget('--filename=https: /attacker', false), undefined);
    });

    test('Delete cancellation prevents execution', async () => {
        const invokeCommandArgsWithFeedback = sinon.stub();
        const report = sinon.stub();
        const kubectl = { invokeCommandArgsWithFeedback } as unknown as Kubectl;

        const executed = await deleteResourceWithConfirmation({
            kubectl,
            resource: 'deployment/api',
            namespace: 'team-a',
            now: false,
            confirm: async () => false,
            report,
        });

        assert.strictEqual(executed, false);
        sinon.assert.notCalled(invokeCommandArgsWithFeedback);
        sinon.assert.notCalled(report);
    });

    test('Delete acceptance executes exact arguments', async () => {
        const result = { resultKind: 'exec-succeeded', stdout: 'deleted' } as const;
        const invokeCommandArgsWithFeedback = sinon.stub().resolves(result);
        const report = sinon.stub().resolves();
        const kubectl = { invokeCommandArgsWithFeedback } as unknown as Kubectl;

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
            invokeCommandArgsWithFeedback,
            ['delete', 'deployment/api', '--namespace', 'team-a', '--now'],
            'Deleting deployment/api...'
        );
        sinon.assert.calledOnceWithExactly(report, result);
    });

    test('Delete preflight cancellation prevents execution', async () => {
        const invokeCommandArgsWithFeedback = sinon.stub();
        const report = sinon.stub();
        const kubectl = { invokeCommandArgsWithFeedback } as unknown as Kubectl;

        const executed = await deleteResourceWithConfirmation({
            kubectl,
            resource: 'namespace/team-a',
            now: false,
            confirm: async () => true,
            beforeDelete: async () => false,
            report,
        });

        assert.strictEqual(executed, false);
        sinon.assert.notCalled(invokeCommandArgsWithFeedback);
        sinon.assert.notCalled(report);
    });

    test('Namespace preflight rejects hostile discovery output before listing resources', async () => {
        const readTableArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            result: [{ name: 'pods;marker', namespaced: 'true', verbs: '[list]' }],
        });
        const invokeCommandArgs = sinon.stub();
        const kubectl = { readTableArgs, invokeCommandArgs } as unknown as Kubectl;

        const result = await listNamespaceResources(kubectl, 'team-a');

        assert.strictEqual(result.succeeded, false);
        sinon.assert.calledOnceWithExactly(readTableArgs, ['api-resources', '-o', 'wide']);
        sinon.assert.notCalled(invokeCommandArgs);
    });

    test('Namespace preflight passes discovered resource types as one argument', async () => {
        const readTableArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            result: [{ name: 'pods', namespaced: 'true', verbs: '[get list]' }],
        });
        const invokeCommandArgs = sinon.stub().resolves({ resultKind: 'exec-succeeded', stdout: 'pod/api-0\n' });
        const kubectl = { readTableArgs, invokeCommandArgs } as unknown as Kubectl;

        const result = await listNamespaceResources(kubectl, 'team-a');

        assert.deepStrictEqual(result, { succeeded: true, result: ['pod/api-0'] });
        sinon.assert.calledOnceWithExactly(invokeCommandArgs, [
            'get', 'pods', '-o', 'name', '--namespace', 'team-a', '--ignore-not-found'
        ]);
    });
});
