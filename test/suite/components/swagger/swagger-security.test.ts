import * as assert from 'assert';
import * as sinon from 'sinon';
import { Kubectl } from '../../../../src/kubectl';
import { getCrdSchemas } from '../../../../src/components/swagger/swagger';

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
