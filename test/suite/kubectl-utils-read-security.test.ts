import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { Kubectl } from '../../src/kubectl';
import { KubernetesResource } from '../../src/kuberesources.objectmodel';
import {
    getCRDTypes,
    getCRDTypesNumber,
    getResourceAsJson,
    getResourceWithSelector,
    getResourceVersion,
    switchNamespace,
} from '../../src/kubectlUtils';
import { listResourceNames } from '../../src/components/kubectl/resource-commands';

suite('Kubectl read security', () => {
    test('passes a resource target and namespace as exact arguments', async () => {
        const asJsonArgs = sinon.stub().resolves({
            succeeded: true,
            result: { kind: 'Pod', metadata: { name: 'api;$(marker)', namespace: 'team-a' } },
        });
        const kubectl = { asJsonArgs } as unknown as Kubectl;

        const result = await getResourceAsJson<KubernetesResource>(kubectl, 'pod/api;$(marker)', 'team-a');

        assert.strictEqual(result?.metadata.name, 'api;$(marker)');
        sinon.assert.calledOnceWithExactly(asJsonArgs, [
            'get', 'pod/api;$(marker)', '--namespace', 'team-a', '-o', 'json'
        ]);
    });

    test('rejects option-like resource input before execution', async () => {
        const asJsonArgs = sinon.stub();
        const kubectl = { asJsonArgs } as unknown as Kubectl;

        const result = await getResourceAsJson(kubectl, '--help', undefined, true);

        assert.strictEqual(result, undefined);
        sinon.assert.notCalled(asJsonArgs);
    });

    test('lists names with argv and preserves opaque resource names', async () => {
        const invokeCommandArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: 'deployment.apps/api;$(marker)\r\n',
        });
        const kubectl = { invokeCommandArgs } as unknown as Kubectl;

        const result = await listResourceNames(kubectl, 'deployments.apps');

        assert.deepStrictEqual(result, { succeeded: true, result: ['api;$(marker)'] });
        sinon.assert.calledOnceWithExactly(invokeCommandArgs, ['get', 'deployments.apps', '-o', 'name']);
    });

    test('rejects malformed resource-name rows', async () => {
        const invokeCommandArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: 'missing-separator\n',
        });
        const kubectl = { invokeCommandArgs } as unknown as Kubectl;

        assert.deepStrictEqual(await listResourceNames(kubectl, 'pods'), {
            succeeded: false,
            error: ['The Kubernetes endpoint returned an invalid resource name.'],
        });
    });

    test('counts only nonempty CRD rows', async () => {
        const invokeCommandArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: 'customresourcedefinition.apiextensions.k8s.io/widgets.example.io\n',
        });
        const kubectl = { invokeCommandArgs } as unknown as Kubectl;

        assert.deepStrictEqual(await getCRDTypesNumber(kubectl), { succeeded: true, result: 1 });
        sinon.assert.calledOnceWithExactly(invokeCommandArgs, ['get', 'crd', '-o', 'name']);
    });

    test('passes CRD JSONPath as one argument', async () => {
        const invokeCommandArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: '\nwidgets.example.io Widget widget widgets wd\n',
        });
        const kubectl = { invokeCommandArgs } as unknown as Kubectl;

        const result = await getCRDTypes(kubectl);

        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].abbreviation, 'wd');
        const args = invokeCommandArgs.firstCall.args[0] as string[];
        assert.deepStrictEqual(args.slice(0, 4), ['get', 'crd', '-o', args[3]]);
        assert.ok(args[3].startsWith('jsonpath={range .items[*]}'));
        assert.strictEqual(args.length, 4);
    });

    test('supports CRDs without a short name and rejects malformed rows', async () => {
        const invokeCommandArgs = sinon.stub();
        invokeCommandArgs.onFirstCall().resolves({
            resultKind: 'exec-succeeded',
            stdout: '\r\nwidgets.example.io Widget widget widgets\r\n',
        });
        invokeCommandArgs.onSecondCall().resolves({
            resultKind: 'exec-succeeded',
            stdout: '\nmissing fields\n',
        });
        const kubectl = { invokeCommandArgs } as unknown as Kubectl;

        const valid = await getCRDTypes(kubectl);
        assert.strictEqual(valid[0].abbreviation, 'widgets.example.io');
        assert.deepStrictEqual(await getCRDTypes(kubectl), []);
    });

    test('reads resource API version through exact explain argv', async () => {
        const invokeCommandArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: 'KIND: Widget\nVERSION: example.io/v1\n',
        });
        const kubectl = { invokeCommandArgs } as unknown as Kubectl;

        assert.strictEqual(await getResourceVersion(kubectl, 'widgets.example.io'), 'example.io/v1');
        sinon.assert.calledOnceWithExactly(invokeCommandArgs, ['explain', 'widgets.example.io']);
    });

    test('preserves an absent selector without turning it into match-all', async () => {
        const readJSON = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            result: {
                'current-context': 'dev',
                contexts: [{ name: 'dev', context: { cluster: 'cluster', user: 'user', namespace: 'team-a' } }],
            },
        });
        const asJsonArgs = sinon.stub().resolves({
            succeeded: true,
            result: {
                items: [{
                    kind: 'Service',
                    metadata: { name: 'external', namespace: 'team-a' },
                    spec: {},
                }],
            },
        });
        const kubectl = { readJSON, asJsonArgs } as unknown as Kubectl;

        const resources = await getResourceWithSelector('services', kubectl);

        assert.strictEqual(resources.length, 1);
        assert.strictEqual(resources[0].selector, undefined);
        sinon.assert.calledOnceWithExactly(asJsonArgs, [
            'get', 'services', '-o', 'json', '--namespace', 'team-a'
        ]);
    });

    test('switches namespace through exact arguments', async () => {
        const invokeCommandArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: 'dev-context\n',
        });
        const invokeCommandArgsWithFeedback = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: '',
        });
        const kubectl = { invokeCommandArgs, invokeCommandArgsWithFeedback } as unknown as Kubectl;

        assert.strictEqual(await switchNamespace(kubectl, 'team-a'), true);
        sinon.assert.calledOnceWithExactly(invokeCommandArgs, ['config', 'current-context']);
        sinon.assert.calledOnceWithExactly(
            invokeCommandArgsWithFeedback,
            ['config', 'set-context', '--namespace', 'team-a', '--', 'dev-context'],
            'Switching namespace...'
        );
    });

    test('rejects an invalid namespace before reading the current context', async () => {
        const showErrorMessage = sinon.stub(vscode.window, 'showErrorMessage').resolves(undefined);
        const invokeCommandArgs = sinon.stub();
        const invokeCommandArgsWithFeedback = sinon.stub();
        const kubectl = { invokeCommandArgs, invokeCommandArgsWithFeedback } as unknown as Kubectl;

        try {
            assert.strictEqual(await switchNamespace(kubectl, 'team;$(marker)'), false);
            sinon.assert.notCalled(invokeCommandArgs);
            sinon.assert.notCalled(invokeCommandArgsWithFeedback);
        } finally {
            showErrorMessage.restore();
        }
    });
});
