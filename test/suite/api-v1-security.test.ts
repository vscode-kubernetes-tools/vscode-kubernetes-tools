import * as assert from 'assert';
import * as sinon from 'sinon';
import { invokeCommandArgs } from '../../src/api/implementation/kubectl/v1';
import { parseHelmV1Command } from '../../src/api/implementation/helm/v1';
import { Kubectl } from '../../src/kubectl';

suite('Legacy API security', () => {
    test('kubectl v1 parses quoting and invokes the argv API', async () => {
        const invokeCommand = sinon.stub().resolves({ resultKind: 'exec-succeeded', stdout: 'ok' });
        const kubectl = { invokeCommand } as unknown as Kubectl;

        const result = await invokeCommandArgs(kubectl, 'get pods --selector "app=my app"');

        assert.deepStrictEqual(result, { code: 0, stdout: 'ok', stderr: '' });
        sinon.assert.calledOnceWithExactly(invokeCommand, ['get', 'pods', '--selector', 'app=my app']);
    });

    test('kubectl v1 rejects shell separators without execution', async () => {
        const invokeCommand = sinon.stub();
        const kubectl = { invokeCommand } as unknown as Kubectl;

        const result = await invokeCommandArgs(kubectl, 'get pods; marker');

        assert.strictEqual(result?.code, -1);
        sinon.assert.notCalled(invokeCommand);
    });

    test('Helm v1 rejects shell syntax and preserves quoted arguments', () => {
        assert.deepStrictEqual(
            parseHelmV1Command('install "release name" repo/chart'),
            ['install', 'release name', 'repo/chart']
        );
        assert.strictEqual(parseHelmV1Command('list && marker'), undefined);
    });
});
