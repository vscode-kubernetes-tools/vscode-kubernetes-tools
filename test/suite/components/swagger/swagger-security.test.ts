import * as assert from 'assert';
import * as sinon from 'sinon';
import { Kubectl } from '../../../../src/kubectl';
import { getClusterSwagger, getCrdSchemas } from '../../../../src/components/swagger/swagger';
import * as proxyModule from '../../../../src/components/kubectl/proxy';
import * as download from '../../../../src/components/download/download';
import { fs } from '../../../../src/fs';

suite('Swagger proxy security', () => {
    let sandbox: sinon.SinonSandbox;
    let dispose: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        dispose = sandbox.stub();
        sandbox.stub(proxyModule, 'proxy').resolves({
            succeeded: true,
            result: { port: 4321, dispose },
        });
    });
    teardown(() => sandbox.restore());

    test('downloads from the IPv4 loopback proxy and disposes it', async () => {
        sandbox.stub(download, 'toTempFile').resolves({ succeeded: true, result: '/tmp/swagger.json' });
        sandbox.stub(fs, 'readTextFile').resolves('{"swagger":"2.0"}');
        const unlink = sandbox.stub(fs, 'unlinkAsync').resolves();
        const kubectl = {} as Kubectl;

        assert.deepStrictEqual(await getClusterSwagger(kubectl), { succeeded: true, result: { swagger: '2.0' } });
        sinon.assert.calledOnceWithExactly(proxyModule.proxy as sinon.SinonStub, kubectl, 'random');
        sinon.assert.calledOnceWithExactly(download.toTempFile as sinon.SinonStub, 'http://127.0.0.1:4321/openapi/v2');
        sinon.assert.calledOnceWithExactly(unlink, '/tmp/swagger.json');
        sinon.assert.calledOnce(dispose);
    });

    test('disposes the proxy when the schema download fails', async () => {
        sandbox.stub(download, 'toTempFile').resolves({ succeeded: false, error: ['download failed'] });

        assert.deepStrictEqual(await getClusterSwagger({} as Kubectl), { succeeded: false, error: ['download failed'] });
        sinon.assert.calledOnce(dispose);
    });

    test('removes the temporary file and disposes the proxy when parsing fails', async () => {
        sandbox.stub(download, 'toTempFile').resolves({ succeeded: true, result: '/tmp/swagger.json' });
        sandbox.stub(fs, 'readTextFile').resolves('invalid json');
        const unlink = sandbox.stub(fs, 'unlinkAsync').resolves();

        await assert.rejects(getClusterSwagger({} as Kubectl), SyntaxError);
        sinon.assert.calledOnceWithExactly(unlink, '/tmp/swagger.json');
        sinon.assert.calledOnce(dispose);
    });
});

suite('Swagger CRD read security', () => {
    test('reads CRD schemas through one structured argv call', async () => {
        const crd = {
            kind: 'CustomResourceDefinition',
            metadata: { name: 'widgets.example.io', namespace: '' },
            spec: {
                group: 'example.io',
                names: { plural: 'widgets', singular: 'widget' },
                versions: [{
                    name: 'v1',
                    schema: { openAPIV3Schema: { properties: { spec: { type: 'object' } } } },
                }],
            },
        };
        const invokeCommandArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: '\nexample.io\twidgets\twidget\tv1,',
        });
        const asJsonArgs = sinon.stub().resolves({ succeeded: true, result: crd });
        const kubectl = fakeKubectl(invokeCommandArgs, asJsonArgs);

        const schemas = await getCrdSchemas(kubectl);

        assert.deepStrictEqual(schemas, {
            'example.io/v1@widget': { spec: { type: 'object' } },
        });
        const discoveryArgs = invokeCommandArgs.firstCall.args[0] as string[];
        assert.deepStrictEqual(discoveryArgs.slice(0, 3), ['get', 'crd', '-o']);
        assert.ok(discoveryArgs[3].startsWith('jsonpath={range .items[*]}'));
        sinon.assert.calledOnceWithExactly(asJsonArgs, ['get', 'crd/widgets.example.io', '-o', 'json']);
    });

    test('ignores malformed CRD metadata without follow-up reads', async () => {
        const invokeCommandArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: '\nmissing\tfields',
        });
        const kubectl = fakeKubectl(invokeCommandArgs);

        assert.deepStrictEqual(await getCrdSchemas(kubectl), {});
        sinon.assert.calledOnce(invokeCommandArgs);
    });

    test('accepts a CRD API group that begins with a digit', async () => {
        const invokeCommandArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: '\n123.example.io\twidgets\twidget\tv1,',
        });
        const asJsonArgs = sinon.stub().resolves({
            succeeded: true,
            result: {
                spec: {
                    versions: [{
                        name: 'v1',
                        schema: { openAPIV3Schema: { properties: { spec: {} } } },
                    }],
                },
            },
        });

        const schemas = await getCrdSchemas(fakeKubectl(invokeCommandArgs, asJsonArgs));

        assert.deepStrictEqual(schemas, { '123.example.io/v1@widget': { spec: {} } });
        sinon.assert.calledOnceWithExactly(asJsonArgs, ['get', 'crd/widgets.123.example.io', '-o', 'json']);
    });

    test('ignores malformed CRD version collections', async () => {
        const invokeCommandArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: '\nexample.io\twidgets\twidget\tv1,',
        });
        const asJsonArgs = sinon.stub().resolves({
            succeeded: true,
            result: {
                kind: 'CustomResourceDefinition',
                metadata: { name: 'widgets.example.io', namespace: '' },
                spec: { versions: {} },
            },
        });

        assert.deepStrictEqual(await getCrdSchemas(fakeKubectl(invokeCommandArgs, asJsonArgs)), {});
    });

    test('ignores a malformed per-CRD JSON object', async () => {
        const invokeCommandArgs = sinon.stub().resolves({
            resultKind: 'exec-succeeded',
            stdout: '\nexample.io\twidgets\twidget\tv1,',
        });
        const asJsonArgs = sinon.stub().resolves({ succeeded: true, result: null });

        assert.deepStrictEqual(await getCrdSchemas(fakeKubectl(invokeCommandArgs, asJsonArgs)), {});
    });

    test('reports CRD command failures', async () => {
        const failure = {
            resultKind: 'exec-errored',
            code: 1,
            stderr: 'forbidden',
        } as const;
        const invokeCommandArgs = sinon.stub().resolves(failure);
        const reportFailure = sinon.stub().resolves();
        const kubectl = { invokeCommandArgs, reportFailure } as unknown as Kubectl;

        assert.strictEqual(await getCrdSchemas(kubectl), undefined);
        sinon.assert.calledOnceWithExactly(reportFailure, failure, { whatFailed: 'Failed to get crds' });
    });
});

function fakeKubectl(
    invokeCommandArgs: sinon.SinonStub,
    asJsonArgs: sinon.SinonStub = sinon.stub().resolves({ succeeded: false, error: ['failed'] })
): Kubectl {
    return {
        invokeCommandArgs,
        asJsonArgs,
        reportFailure: async () => {},
    } as unknown as Kubectl;
}
