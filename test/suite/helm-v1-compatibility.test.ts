import * as assert from 'assert';
import * as sinon from 'sinon';
import * as helmExec from '../../src/helm.exec';
import { apiVersion } from '../../src/api/implementation/helm/versions';
import { HelmV1 } from '../../src/api/contract/helm/v1';

suite('Helm v1 compatibility', () => {
    test('preserves the public command-string contract', async () => {
        const command = 'template "chart path" | external-consumer-pipeline';
        const result = { code: 0, stdout: 'rendered', stderr: 'warning' };
        const helmExecAsync = sinon.stub(helmExec, 'helmExecAsync').resolves(result);

        try {
            const api = apiVersion('v1');
            assert.strictEqual(api.available, true);
            const actual = await (api.api as HelmV1).invokeCommand(command);

            assert.strictEqual(actual, result);
            sinon.assert.calledOnceWithExactly(helmExecAsync, command);
        } finally {
            helmExecAsync.restore();
        }
    });
});
