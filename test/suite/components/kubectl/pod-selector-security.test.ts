import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { Kubectl } from '../../../../src/kubectl';
import { getPods } from '../../../../src/kubectlUtils';
import * as resources from '../../../../src/kuberesources';
import { ResourceNode } from '../../../../src/components/clusterexplorer/node.resource';
import { podLister } from '../../../../src/components/clusterexplorer/resourcekinds/resourcekind.pod';
import { nodePodsChildSource } from '../../../../src/components/clusterexplorer/resourcekinds/resourcekind.node';
import { selectedPodsChildSource } from '../../../../src/components/clusterexplorer/resourcekinds/resourcekinds.selectspods';

const binary = { binBaseName: 'kubectl', configKeyName: 'kubectl', displayName: 'Kubectl', offersInstall: true };
const pod = { name: '1.api-0', node: 'node-a', status: 'Running', ready: '1/1' };

suite('Selector-based pod lookup security', () => {
    let sandbox: sinon.SinonSandbox;
    let showError: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        showError = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
    });
    teardown(() => sandbox.restore());

    function fakeKubectl(namespace = 'team-a', rows: object[] = [pod]) {
        const table = { resultKind: 'exec-succeeded', execProgram: binary, command: 'get pods', result: rows };
        const lookup = sandbox.stub().resolves(table);
        const legacy = sandbox.stub().rejects(new Error('Pod lookup must not use a shell command string.'));
        const config = { 'current-context': 'ctx', contexts: [{ name: 'ctx', context: { namespace } }] };
        const readJSON = sandbox.stub().resolves({
            resultKind: 'exec-succeeded',
            result: config,
        });
        const invokeConfig = sandbox.stub().resolves({
            resultKind: 'exec-succeeded', execProgram: binary, command: 'config view', stdout: JSON.stringify(config),
        });
        const reportFailure = sandbox.stub().resolves();
        const kubectl = { readTableArgs: lookup, readTable: legacy, readJSON, invokeCommandArgs: invokeConfig, reportFailure } as unknown as Kubectl;
        return { kubectl, lookup, legacy, readJSON, invokeConfig, reportFailure, table };
    }

    test('passes a Service selector as one argument and preserves wide pod information', async () => {
        const fixture = fakeKubectl();
        const parent = new ResourceNode(resources.allKinds.service, 'api', { name: 'api', namespace: 'team-a' }, {
            labelSelector: { app: 'api', tier: 'front-end' },
        });

        const children = await selectedPodsChildSource.children(fixture.kubectl, parent);

        sinon.assert.calledOnceWithExactly(fixture.lookup, [
            'get', 'pods', '-o', 'wide', '--namespace=team-a', '--selector=app=api,tier=front-end',
        ]);
        assert.deepStrictEqual((children[0] as ResourceNode).extraInfo?.podInfo, {
            name: pod.name, namespace: 'team-a', nodeName: pod.node, status: pod.status, ready: pod.ready,
            metadata: { name: pod.name, namespace: 'team-a' },
        });
        sinon.assert.notCalled(fixture.legacy);
    });

    test('ANDs matchLabels with all supported set-based requirements', async () => {
        const fixture = fakeKubectl();

        await getPods(fixture.kubectl, {
            matchLabels: { app: 'api' },
            matchExpressions: [
                { key: 'environment', operator: 'In', values: ['prod', 'qa'] },
                { key: 'tier', operator: 'NotIn', values: ['edge'] },
                { key: 'present', operator: 'Exists' },
                { key: 'absent', operator: 'DoesNotExist', values: [] },
            ],
        }, 'team-a');

        assert.strictEqual(fixture.lookup.firstCall.args[0][5],
            '--selector=app=api,environment in (prod,qa),tier notin (edge),present,!absent');
    });

    test('keeps qualified keys, empty label values and a literal matchLabels key', async () => {
        const fixture = fakeKubectl();
        const parent = new ResourceNode(resources.allKinds.service, 'api', { name: 'api', namespace: 'team-a' }, {
            labelSelector: { 'example.com/App': '', matchLabels: 'literal' },
        });

        await selectedPodsChildSource.children(fixture.kubectl, parent);

        assert.strictEqual(fixture.lookup.firstCall.args[0][5], '--selector=example.com/App=,matchLabels=literal');
    });

    test('rejects hostile selector values before any pod lookup', async () => {
        const fixture = fakeKubectl();

        assert.deepStrictEqual(await getPods(fixture.kubectl, { matchLabels: { app: 'api,other=true;$(marker)' } }, 'team-a'), []);

        sinon.assert.notCalled(fixture.lookup);
        sinon.assert.notCalled(fixture.legacy);
        sinon.assert.calledOnce(showError);
    });

    test('rejects invalid expression requirements instead of dropping their constraints', async () => {
        const fixture = fakeKubectl();

        assert.deepStrictEqual(await getPods(fixture.kubectl, {
            matchLabels: { app: 'api' },
            matchExpressions: [{ key: 'environment', operator: 'In', values: [] }],
        }, 'team-a'), []);

        sinon.assert.notCalled(fixture.lookup);
        sinon.assert.notCalled(fixture.legacy);
        sinon.assert.calledOnce(showError);
    });

    test('does not reinterpret a malformed workload selector as a Service label map', async () => {
        const fixture = fakeKubectl();
        const parent = new ResourceNode(resources.allKinds.deployment, 'api', { name: 'api', namespace: 'team-a' }, {
            labelSelector: { matchLabels: 'not-a-map' },
        });

        assert.deepStrictEqual(await selectedPodsChildSource.children(fixture.kubectl, parent), []);

        sinon.assert.notCalled(fixture.lookup);
        sinon.assert.calledOnce(showError);
    });

    test('keeps empty Service selectors distinct from empty workload LabelSelectors', async () => {
        const fixture = fakeKubectl();
        const service = new ResourceNode(resources.allKinds.service, 'api', { name: 'api', namespace: 'team-a' }, {
            labelSelector: {},
        });
        const job = new ResourceNode(resources.allKinds.job, 'job', { name: 'job', namespace: 'team-a' }, {
            labelSelector: {},
        });

        assert.deepStrictEqual(await selectedPodsChildSource.children(fixture.kubectl, service), []);
        sinon.assert.notCalled(fixture.lookup);
        assert.strictEqual((await selectedPodsChildSource.children(fixture.kubectl, job)).length, 1);

        sinon.assert.calledOnceWithExactly(fixture.lookup, ['get', 'pods', '-o', 'wide', '--namespace=team-a']);
    });

    test('rejects an invalid namespace before any pod lookup', async () => {
        const fixture = fakeKubectl();

        assert.deepStrictEqual(await getPods(fixture.kubectl, { matchLabels: { app: 'api' } }, 'team-a;$(marker)'), []);

        sinon.assert.notCalled(fixture.lookup);
        sinon.assert.notCalled(fixture.legacy);
        sinon.assert.calledOnce(showError);
    });

    test('preserves the unfiltered Pod view in the current namespace', async () => {
        const fixture = fakeKubectl();

        const children = await podLister.list(fixture.kubectl, resources.allKinds.pod);

        sinon.assert.calledOnceWithExactly(fixture.lookup, ['get', 'pods', '-o', 'wide', '--namespace=team-a']);
        assert.strictEqual((children[0] as ResourceNode).namespace, 'team-a');
    });

    test('preserves the Node view query across all namespaces', async () => {
        const fixture = fakeKubectl('team-a', [{ ...pod, namespace: 'team-b' }]);
        const parent = new ResourceNode(resources.allKinds.node, 'node-a', { name: 'node-a', namespace: '' }, undefined);

        const children = await nodePodsChildSource.children(fixture.kubectl, parent);

        sinon.assert.calledOnceWithExactly(fixture.lookup, ['get', 'pods', '-o', 'wide', '--all-namespaces']);
        sinon.assert.notCalled(fixture.readJSON);
        sinon.assert.notCalled(fixture.invokeConfig);
        assert.strictEqual((children[0] as ResourceNode).namespace, 'team-b');
    });

    test('uses the parent resource namespace, including a literal namespace named all', async () => {
        const fixture = fakeKubectl('other');
        const parent = new ResourceNode(resources.allKinds.deployment, 'api', { name: 'api', namespace: 'all' }, {
            labelSelector: { matchLabels: { app: 'api' } },
        });

        const children = await selectedPodsChildSource.children(fixture.kubectl, parent);

        sinon.assert.calledOnceWithExactly(fixture.lookup, [
            'get', 'pods', '-o', 'wide', '--namespace=all', '--selector=app=api',
        ]);
        sinon.assert.notCalled(fixture.readJSON);
        sinon.assert.notCalled(fixture.invokeConfig);
        assert.strictEqual((children[0] as ResourceNode).namespace, 'all');
    });

    test('rejects unsafe pod identities and namespace redirection in table responses', async () => {
        for (const row of [{ ...pod, name: 'api;$(marker)' }, { ...pod, namespace: 'team-b' }]) {
            const fixture = fakeKubectl('team-a', [row]);
            fixture.legacy.resolves(fixture.table);

            assert.deepStrictEqual(await getPods(fixture.kubectl, { matchLabels: { app: 'api' } }, 'team-a'), []);
        }
        sinon.assert.calledTwice(showError);
    });

    test('does not invent a namespace when an all-namespace response omits it', async () => {
        const fixture = fakeKubectl();
        fixture.legacy.resolves(fixture.table);
        const parent = new ResourceNode(resources.allKinds.node, 'node-a', { name: 'node-a', namespace: '' }, undefined);

        assert.deepStrictEqual(await nodePodsChildSource.children(fixture.kubectl, parent), []);

        sinon.assert.calledOnce(showError);
    });

    test('preserves kubectl failure reporting', async () => {
        const fixture = fakeKubectl();
        const result = { resultKind: 'exec-errored', execProgram: binary, command: 'get pods', code: 1, stderr: 'Forbidden' };
        fixture.lookup.resolves(result);
        fixture.legacy.resolves(result);

        assert.deepStrictEqual(await getPods(fixture.kubectl, { matchLabels: { app: 'api' } }, 'team-a'), []);

        sinon.assert.calledOnceWithExactly(fixture.reportFailure, result, {});
    });
});
