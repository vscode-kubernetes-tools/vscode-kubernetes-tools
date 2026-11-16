import * as assert from 'assert';
import * as sinon from 'sinon';
import { ExecResult } from '../../src/binutilplusplus';
import { Kubectl } from '../../src/kubectl';
import * as telemetry from '../../src/telemetry';
import { invalidateClusterType, telemetrise } from '../../src/telemetry-helper';

const binary = { binBaseName: 'kubectl', configKeyName: 'kubectl', displayName: 'Kubectl', offersInstall: true };
let contextNumber = 0;

function success(stdout: string): ExecResult {
    return { resultKind: 'exec-succeeded', execProgram: binary, command: 'display only', stdout };
}

suite('Telemetry command security', () => {
    let sandbox: sinon.SinonSandbox;
    let contextName: string;
    let currentContext: ExecResult;
    let clusterInfo: ExecResult;
    let contexts: ExecResult;
    let invoke: sinon.SinonStub;
    let legacy: sinon.SinonStub;
    let event: sinon.SinonStub;
    let kubectl: Kubectl;

    setup(() => {
        sandbox = sinon.createSandbox();
        contextName = `--telemetry-${++contextNumber} "two";$(marker)&%NAME%`;
        currentContext = success(`${contextName}\n`);
        clusterInfo = success('Kubernetes control plane is running at https://api.example.invalid\n');
        contexts = success('synthetic context row\n');
        invoke = sandbox.stub().callsFake(async (args: readonly string[]) => {
            if (args[0] === 'cluster-info') { return clusterInfo; }
            return args[1] === 'current-context' ? currentContext : contexts;
        });
        legacy = sandbox.stub().callsFake(async (command: string) => {
            if (command === 'cluster-info') { return clusterInfo; }
            return command === 'config current-context' ? currentContext : contexts;
        });
        kubectl = { invokeCommandArgs: invoke, invokeCommand: legacy } as unknown as Kubectl;
        event = sandbox.stub();
        sandbox.stub(telemetry, 'reporter').value({ sendTelemetryEvent: event });
        invalidateClusterType(undefined);
    });
    teardown(() => {
        invalidateClusterType(undefined);
        sandbox.restore();
    });

    function classify(): Promise<Record<string, string>> {
        return new Promise((resolve) => {
            event.callsFake((_name: string, properties: Record<string, string>) => resolve(properties));
            const callback = sandbox.stub().returns('callback result');

            assert.strictEqual(telemetrise('test-command', kubectl, callback)('input'), 'callback result');
            sinon.assert.calledOnceWithExactly(callback, 'input');
        });
    }

    test('keeps an opaque current-context name after the option terminator without a shell lookup', async () => {
        assert.deepStrictEqual(await classify(), { command: 'test-command', clusterType: 'other', nonDeterminationReason: 'master_url_not_recognised' });

        assert.deepStrictEqual(invoke.args, [
            [['config', 'current-context']],
            [['cluster-info']],
            [['config', 'get-contexts', '--', contextName]],
        ]);
        sinon.assert.notCalled(legacy);
    });

    test('uses the selected context and reuses its cached classification', async () => {
        invalidateClusterType(contextName);
        contexts = success('synthetic minikube context row\n');

        const first = await classify();
        assert.strictEqual(first.clusterType, 'minikube');
        assert.deepStrictEqual(await classify(), first);

        assert.deepStrictEqual(invoke.args, [
            [['cluster-info']],
            [['config', 'get-contexts', '--', contextName]],
        ]);
        sinon.assert.notCalled(legacy);
    });

    test('preserves Azure detection without the fallback context query', async () => {
        invalidateClusterType(contextName);
        clusterInfo = success('Kubernetes control plane is running at https://cluster.eastus.azmk8s.io:443\n');

        assert.strictEqual((await classify()).clusterType, 'azure');

        sinon.assert.calledOnceWithExactly(invoke, ['cluster-info']);
        sinon.assert.notCalled(legacy);
    });

    test('stops classification when the current context cannot be read', async () => {
        currentContext = { resultKind: 'exec-errored', execProgram: binary, command: 'display only', code: 1, stderr: 'no current context' };

        assert.deepStrictEqual(await classify(), { command: 'test-command', clusterType: 'other', nonDeterminationReason: 'error_getting_current_context' });

        sinon.assert.calledOnceWithExactly(invoke, ['config', 'current-context']);
        sinon.assert.notCalled(legacy);
    });

    test('keeps cluster connection failures distinct from context lookup failures', async () => {
        invalidateClusterType(contextName);
        clusterInfo = { resultKind: 'exec-errored', execProgram: binary, command: 'display only', code: 1, stderr: 'dial tcp 127.0.0.1:6443: connectex: target machine actively refused it' };

        const result = await classify();
        assert.strictEqual(result.clusterType, 'local_unreachable');
        assert.strictEqual(result.nonDeterminationReason, 'cluster_connection_refused');

        sinon.assert.calledOnceWithExactly(invoke, ['cluster-info']);
        sinon.assert.notCalled(legacy);
    });
});
