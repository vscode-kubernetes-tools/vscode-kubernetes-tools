import * as assert from 'assert';
import * as querystring from 'querystring';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import * as config from '../../src/components/config/config';
import { Host } from '../../src/host';
import { Kubectl } from '../../src/kubectl';
import {
    K8S_RESOURCE_SCHEME,
    KUBECTL_DESCRIBE_AUTHORITY,
    KUBECTL_RESOURCE_AUTHORITY,
    KubernetesResourceVirtualFileSystemProvider,
    kubefsUri,
} from '../../src/kuberesources.virtualfs';

suite('Virtual resource read security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => sandbox.restore());

    test('round-trips URI query values without changing field boundaries', () => {
        const uri = kubefsUri('team-a', 'pods/api&value=x#frag%25;$(marker)', 'yaml');
        const query = querystring.parse(uri.query);

        assert.strictEqual(query.ns, 'team-a');
        assert.strictEqual(query.value, 'pods/api&value=x#frag%25;$(marker)');
        assert.strictEqual(uri.authority, KUBECTL_RESOURCE_AUTHORITY);
        assert.strictEqual(uri.fragment, '');
    });

    test('loads a resource using exact argv', async () => {
        sandbox.stub(config, 'getOutputFormat').returns('yaml');
        const invokeCommandArgsWithFeedback = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: 'kind: Pod\n',
        });
        const provider = new KubernetesResourceVirtualFileSystemProvider(
            { invokeCommandArgsWithFeedback } as unknown as Kubectl,
            fakeHost()
        );

        const content = await provider.loadResource(kubefsUri('team-a', 'pods/api;$(marker)', 'yaml'));

        assert.strictEqual(content, 'kind: Pod\n');
        sinon.assert.calledOnceWithExactly(
            invokeCommandArgsWithFeedback,
            ['get', 'pods/api;$(marker)', '-o', 'yaml', '--namespace', 'team-a'],
            'Loading pods/api;$(marker)...'
        );
    });

    test('describes a resource using exact argv', async () => {
        const invokeCommandArgsWithFeedback = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: 'Name: api\n',
        });
        const provider = new KubernetesResourceVirtualFileSystemProvider(
            { invokeCommandArgsWithFeedback } as unknown as Kubectl,
            fakeHost()
        );

        const result = await provider.execLoadResource(
            KUBECTL_DESCRIBE_AUTHORITY,
            'team-a',
            'pods/api;$(marker)',
            undefined,
            ''
        );

        assert.strictEqual(result.succeeded, true);
        sinon.assert.calledOnceWithExactly(
            invokeCommandArgsWithFeedback,
            ['describe', 'pods/api;$(marker)', '--namespace', 'team-a'],
            'Loading pods/api;$(marker)...'
        );
    });

    test('rejects duplicate query fields before execution', async () => {
        sandbox.stub(config, 'getOutputFormat').returns('yaml');
        const invokeCommandArgsWithFeedback = sinon.stub();
        const showErrorMessage = sinon.stub().resolves(undefined);
        const provider = new KubernetesResourceVirtualFileSystemProvider(
            { invokeCommandArgsWithFeedback } as unknown as Kubectl,
            fakeHost(showErrorMessage)
        );
        const uri = Uri.from({
            scheme: K8S_RESOURCE_SCHEME,
            authority: KUBECTL_RESOURCE_AUTHORITY,
            path: '/pod.yaml',
            query: 'value=pods%2Fapi&value=pods%2Fother',
        });

        await assert.rejects(() => provider.loadResource(uri));
        sinon.assert.notCalled(invokeCommandArgsWithFeedback);
        sinon.assert.calledOnceWithExactly(showErrorMessage, 'Invalid Kubernetes resource URI.');
    });
});

function fakeHost(showErrorMessage: sinon.SinonStub = sinon.stub().resolves(undefined)): Host {
    return { showErrorMessage } as unknown as Host;
}
