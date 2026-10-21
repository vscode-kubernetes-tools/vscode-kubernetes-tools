import * as assert from 'assert';
import * as sinon from 'sinon';
import { ResourceFolderNode } from '../../../../src/components/clusterexplorer/node.folder.resource';
import { ResourceNode } from '../../../../src/components/clusterexplorer/node.resource';
import { podStatusChildSource } from '../../../../src/components/clusterexplorer/resourcekinds/resourcekind.pod';
import { Host } from '../../../../src/host';
import { Kubectl } from '../../../../src/kubectl';
import { ResourceKind } from '../../../../src/kuberesources';

suite('Explorer resource read security', () => {
    test('lists resource metadata through exact argv', async () => {
        const invokeCommandArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: 'api;$(marker)\tteam-a\n',
        });
        const kubectl = fakeJsonKubectl(invokeCommandArgs);
        const kind = new ResourceKind('Widget', 'Widgets', 'Widget', 'widgets.example.io', 'widgets');
        const folder = new ResourceFolderNode(kind);

        const children = await folder.getChildren(kubectl, fakeHost());

        const args = invokeCommandArgs.firstCall.args[0] as string[];
        assert.deepStrictEqual(args.slice(0, 3), ['get', 'widgets.example.io', '-o']);
        assert.ok(args[3].startsWith('jsonpath={range .items[*]}'));
        assert.strictEqual(children.length, 1);
        const resource = children[0] as ResourceNode;
        assert.strictEqual(resource.name, 'api;$(marker)');
        assert.strictEqual(resource.namespace, 'team-a');
        assert.strictEqual(resource.kindName, 'widgets.example.io/api;$(marker)');
    });

    test('rejects an invalid discovered resource type before execution', async () => {
        const invokeCommandArgs = sinon.stub();
        const showErrorMessage = sinon.stub().resolves(undefined);
        const kind = new ResourceKind('Widget', 'Widgets', 'Widget', 'widgets;$(marker)', 'widgets');
        const folder = new ResourceFolderNode(kind);

        const children = await folder.getChildren(fakeJsonKubectl(invokeCommandArgs), fakeHost(showErrorMessage));

        assert.strictEqual(children.length, 1);
        sinon.assert.notCalled(invokeCommandArgs);
        sinon.assert.calledOnceWithExactly(showErrorMessage, 'The Kubernetes endpoint returned an invalid resource type.');
    });

    test('reads a pod status using one canonical target argument', async () => {
        const invokeCommandArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: JSON.stringify({
                kind: 'Pod',
                metadata: { name: 'api;$(marker)', namespace: 'team-a' },
                spec: { containers: [] },
                status: {
                    phase: 'Running',
                    podIP: '10.0.0.1',
                    containerStatuses: [{ ready: true }],
                },
            }),
        });
        const kubectl = fakeJsonKubectl(invokeCommandArgs);
        const parent = ResourceNode.create(
            new ResourceKind('Pod', 'Pods', 'Pod', 'pod', 'pods'),
            'api;$(marker)',
            { name: 'api;$(marker)', namespace: 'team-a' },
            undefined
        ) as ResourceNode;

        const children = await podStatusChildSource.children(kubectl, parent);

        sinon.assert.calledOnceWithExactly(invokeCommandArgs, [
            'get', 'pods/api;$(marker)', '--namespace', 'team-a', '-o', 'json'
        ]);
        assert.strictEqual(children.length, 2);
    });

    test('normalises an omitted namespace for cluster-scoped resources', async () => {
        const invokeCommandArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: 'node-a\t\n',
        });
        const kind = new ResourceKind('Node', 'Nodes', 'Node', 'nodes', 'nodes');

        const children = await new ResourceFolderNode(kind).getChildren(fakeJsonKubectl(invokeCommandArgs), fakeHost());

        assert.strictEqual((children[0] as ResourceNode).namespace, '');
    });
});

function fakeJsonKubectl(invokeCommandArgs: sinon.SinonStub): Kubectl {
    return {
        invokeCommandArgs,
        asJsonArgs: async <T>(args: readonly string[]) => {
            const result = await invokeCommandArgs(args);
            return result.resultKind === 'exec-succeeded' ?
                { succeeded: true, result: JSON.parse(result.stdout) as T } :
                { succeeded: false, error: [result.stderr || 'failed'] };
        },
    } as unknown as Kubectl;
}

function fakeHost(showErrorMessage: sinon.SinonStub = sinon.stub().resolves(undefined)): Host {
    return { showErrorMessage } as unknown as Host;
}
