import * as assert from 'assert';
import * as sinon from 'sinon';
import type { ExtensionContext } from 'vscode';
import type { Kubectl } from '../../src/kubectl';
import * as config from '../../src/components/config/config';
import { recommendExtensions } from '../../src/components/recommender/extension-recommender';
import { KubernetesClusterSchemaHolder } from '../../src/yaml-support/schema-holder';

suite('Optional CLI-backed startup work', () => {
    let sandbox: sinon.SinonSandbox;
    let kubectl: Kubectl;
    let invoke: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        invoke = sandbox.stub().rejects(new Error('Missing kubectl must not be invoked.'));
        kubectl = { ensurePresent: sandbox.stub().resolves(false), invokeCommand: invoke,
            invokeCommandArgs: invoke, spawnCommandArgs: invoke } as unknown as Kubectl;
    });
    teardown(() => sandbox.restore());

    test('uses the bundled YAML schema when kubectl is unavailable', async () => {
        const fallback = {} as KubernetesClusterSchemaHolder;
        sandbox.stub(KubernetesClusterSchemaHolder, 'fallback').returns(fallback);

        assert.strictEqual(await KubernetesClusterSchemaHolder.fromActiveCluster(kubectl), fallback);

        sinon.assert.notCalled(invoke);
    });

    test('skips tool-dependent recommendations when kubectl is unavailable', async () => {
        sandbox.stub(config, 'ignoreK8sRecommendations').returns(false);

        await recommendExtensions(kubectl, {} as ExtensionContext);

        sinon.assert.notCalled(invoke);
    });
});
