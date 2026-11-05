import * as sinon from 'sinon';
import { clusterInfoKubernetesCore, getKubernetesCore, GetCommandDependencies } from '../../src/extension';

suite('Read-only terminal command security', () => {
    test('passes structured Explorer resource values as exact arguments', async () => {
        const dependencies = fakeGetDependencies();
        const node = {
            nodeType: 'resource',
            kind: { abbreviation: 'Role' },
            name: 'team reader ${env:SECRET};$(marker)',
            namespace: 'team-a',
        };

        await getKubernetesCore(node, dependencies);

        sinon.assert.calledOnceWithExactly(dependencies.invoke as sinon.SinonStub, [
            'get', 'role/team reader ${env:SECRET};$(marker)', '--namespace', 'team-a', '-o', 'wide',
        ], 'Kubernetes Get');
        sinon.assert.notCalled(dependencies.prompt as sinon.SinonStub);
        sinon.assert.notCalled(dependencies.showError as sinon.SinonStub);
    });

    test('passes Explorer folders and valid prompt values as exact arguments', async () => {
        const folderDependencies = fakeGetDependencies();
        await getKubernetesCore({ nodeType: 'folder.resource', kind: { abbreviation: 'Pods' } }, folderDependencies);
        sinon.assert.calledOnceWithExactly(
            folderDependencies.invoke as sinon.SinonStub,
            ['get', 'pods', '-o', 'wide'],
            'Kubernetes Get'
        );

        const promptDependencies = fakeGetDependencies('Pod api');
        await getKubernetesCore(undefined, promptDependencies);
        sinon.assert.calledOnceWithExactly(
            promptDependencies.invoke as sinon.SinonStub,
            ['get', 'pod/api', '-o', 'wide'],
            'Kubernetes Get'
        );
    });

    test('preserves multi-resource queries and flags as structured argv', async () => {
        for (const [query, args] of [
            ['Pods,Services', ['pods,services']],
            ['pods --all-namespaces', ['pods', '--all-namespaces']],
            ['pod/api --namespace other', ['pod/api', '--namespace', 'other']],
            ['pods api worker', ['pods', 'api', 'worker']],
            ['pods -l "app in (api, worker)"', ['pods', '-l', 'app in (api, worker)']],
            ["pods --context '${env:SECRET};$(marker)'", ['pods', '--context', '${env:SECRET};$(marker)']],
        ] as const) {
            const dependencies = fakeGetDependencies(query);
            await getKubernetesCore(undefined, dependencies);
            sinon.assert.calledOnceWithExactly(dependencies.invoke as sinon.SinonStub,
                ['get', ...args, '-o', 'wide'], 'Kubernetes Get');
            sinon.assert.notCalled(dependencies.showError as sinon.SinonStub);
        }
    });

    test('rejects malformed Get targets before launch', async () => {
        for (const [node, prompted] of [
            [{ nodeType: 'other' }, undefined],
            [{ nodeType: 'resource', kind: { abbreviation: 'Pod' }, namespace: 'team-a' }, undefined],
            [{ nodeType: 'resource', name: 'api', namespace: 'team-a' }, undefined],
            [{ nodeType: 'folder.resource' }, undefined],
            [undefined, 'pods,'],
            [undefined, 'pods --selector "unterminated'],
            [undefined, '--filename=https://example.com'],
            [undefined, 'pods\nservices'],
        ] as const) {
            const dependencies = fakeGetDependencies(prompted);
            await getKubernetesCore(node, dependencies);
            sinon.assert.notCalled(dependencies.invoke as sinon.SinonStub);
            sinon.assert.calledOnceWithExactly(dependencies.showError as sinon.SinonStub, 'Invalid Kubernetes resource target.');
        }
    });

    test('cancellation does not launch Get', async () => {
        const dependencies = fakeGetDependencies(undefined);
        await getKubernetesCore(undefined, dependencies);
        sinon.assert.notCalled(dependencies.invoke as sinon.SinonStub);
        sinon.assert.notCalled(dependencies.showError as sinon.SinonStub);
    });

    test('passes Cluster Info as exact argv', async () => {
        const invoke = sinon.stub().resolves();
        await clusterInfoKubernetesCore(invoke);
        sinon.assert.calledOnceWithExactly(invoke, ['cluster-info'], 'Kubernetes Cluster Info');
    });
});

function fakeGetDependencies(prompted?: string): GetCommandDependencies {
    return {
        prompt: sinon.stub().resolves(prompted),
        invoke: sinon.stub().resolves(),
        showError: sinon.stub().resolves(undefined),
    };
}
