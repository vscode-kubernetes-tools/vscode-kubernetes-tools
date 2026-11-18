import * as assert from 'assert';
import * as sinon from 'sinon';
import * as config from '../../src/components/config/config';
import * as autoversion from '../../src/components/kubectl/autoversion';
import * as processes from '../../src/process';
import * as binutil from '../../src/binutil';
import * as wsl from '../../src/wsl';
import { FS, fs } from '../../src/fs';
import { Host } from '../../src/host';
import { create, createOnBinary, Kubectl } from '../../src/kubectl';
import { Platform, Shell } from '../../src/shell';
import { FileBacked } from '../../src/utils/filebacked';

suite('Scoped internal kubectl execution', () => {
    let sandbox: sinon.SinonSandbox;
    let kubectl: Kubectl | undefined;

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(config, 'getEnableSnapFlag').returns(false);
    });
    teardown(() => { kubectl?.dispose(); kubectl = undefined; sandbox.restore(); });

    test('binds execution and automatic version selection to explicit connection options', async () => {
        const resolver = sandbox.stub(autoversion, 'ensureSuitableKubectl').resolves('/selected/kubectl');
        const execute = sandbox.stub(processes, 'executeCommand').resolves({ code: 7, stdout: ' out\n', stderr: ' err\n' });
        const shell = fakeShell();
        const environment = { KUBECONFIG: '/default/config', CUSTOM: 'retained' };
        sandbox.stub(shell, 'execOpts').returns({ cwd: '/workspace', env: environment });
        kubectl = create(config.KubectlVersioning.Infer, {} as Host, {} as FS, shell);
        const selection = { kubeconfig: '/selected/config a:/selected/config b', context: 'selected context' };

        const result = await kubectl.executeCommandArgs(['get', 'namespaces', '-o', 'json'], undefined, selection);

        assert.deepStrictEqual(result, { code: 7, stdout: ' out\n', stderr: ' err\n' });
        assert.deepStrictEqual(resolver.firstCall.args[4], selection);
        assert.deepStrictEqual(execute.firstCall.args[0].args, ['--context', 'selected context', 'get', 'namespaces', '-o', 'json']);
        assert.deepStrictEqual(execute.firstCall.args[0].env, { KUBECONFIG: selection.kubeconfig, CUSTOM: 'retained' });
        assert.strictEqual(execute.firstCall.args[0].cwd, '/workspace');
        assert.strictEqual(environment.KUBECONFIG, '/default/config');
    });

    test('probes each scoped cluster rather than reusing the global context cache', async () => {
        sandbox.stub(fs, 'existsAsync').resolves(true);
        const cache = sandbox.stub(FileBacked.prototype, 'get').rejects(new Error('The global cache must not be used'));
        sandbox.stub(config, 'getToolPath').returns(process.execPath);
        const execute = sandbox.stub(processes, 'executeCommand').callsFake(async (invocation) => ({
            code: 0, stderr: '', stdout: JSON.stringify({ serverVersion: { gitVersion: invocation.env?.KUBECONFIG === '/cluster-a' ? 'v1.32.0' : 'v1.33.0' } }),
        }));
        kubectl = create(config.KubectlVersioning.Infer, {} as Host, {} as FS, fakeShell());

        for (const kubeconfig of ['/cluster-a', '/cluster-b']) {
            await kubectl.executeCommandArgs(['get', 'namespaces'], undefined, { kubeconfig, context: 'same-name' });
            const calls = execute.getCalls().slice(-3);
            assert.strictEqual(calls.length, 3);
            assert.ok(calls.every((call) => call.args[0].env?.KUBECONFIG === kubeconfig));
            assert.ok(calls.every((call) => call.args[0].args[0] === '--context' && call.args[0].args[1] === 'same-name'));
            assert.ok(calls[2].args[0].executable.includes(kubeconfig === '/cluster-a' ? 'v1.32.0' : 'v1.33.0'));
        }
        sinon.assert.notCalled(cache);
    });

    test('does not launch after cancellation during executable resolution', async () => {
        let finish!: (binary: string) => void;
        sandbox.stub(autoversion, 'ensureSuitableKubectl').returns(new Promise<string>((resolve) => { finish = resolve; }));
        const execute = sandbox.spy(processes, 'executeCommand');
        kubectl = create(config.KubectlVersioning.Infer, {} as Host, {} as FS, fakeShell());
        const controller = new AbortController();
        const result = kubectl.executeCommandArgs(['get', 'namespaces'], undefined, { signal: controller.signal });
        controller.abort();
        finish(process.execPath);

        await assert.rejects(result, (error: unknown) => error instanceof processes.ProcessExecutionError && error.reason === 'cancelled');
        sinon.assert.notCalled(execute);
    });

    test('extension cleanup cancels active execution and prevents new commands', async () => {
        kubectl = createOnBinary({} as Host, {} as FS, fakeShell(), process.execPath);
        const result = kubectl.executeCommandArgs(['-e', 'process.stdout.write("ready");setInterval(()=>{},1000)'], undefined,
            { onStdout: () => kubectl!.dispose() });

        await assert.rejects(result, (error: unknown) => error instanceof processes.ProcessExecutionError &&
            error.reason === 'cancelled' && error.stdout === 'ready');
        await assert.rejects(kubectl.executeCommandArgs(['-e', 'process.exit(0)']),
            (error: unknown) => error instanceof processes.ProcessExecutionError && error.reason === 'cancelled');
    });

    test('never falls back to working-directory lookup when safe PATH discovery fails', async () => {
        const find = sandbox.stub(binutil, 'findBinaryPath').resolves(undefined);
        const execute = sandbox.spy(processes, 'executeCommand');
        kubectl = createOnBinary({} as Host, {} as FS, fakeShell(), 'kubectl');

        await assert.rejects(kubectl.executeCommandArgs(['get', 'namespaces']),
            (error: unknown) => error instanceof processes.ProcessExecutionError && error.reason === 'spawn-failed');
        sinon.assert.calledOnce(find);
        sinon.assert.notCalled(execute);
    });

    test('forwards guest kubeconfig paths through WSL without converting or evaluating them', async () => {
        (config.getUseWsl as sinon.SinonStub).returns(true);
        sandbox.stub(wsl, 'getWindowsSystemExecutable').returns('C:\\Windows\\System32\\wsl.exe');
        const execute = sandbox.stub(processes, 'executeCommand').resolves({ code: 0, stdout: '', stderr: '' });
        const shell = fakeShell(true);
        sandbox.stub(shell, 'execOpts').returns({ env: { WSLENV: 'EXISTING/u:KUBECONFIG/p:OTHER' } });
        kubectl = createOnBinary({} as Host, {} as FS, shell, '/opt/Kube Tools/kubectl');

        await kubectl.executeCommandArgs(['get', 'namespaces'], undefined, { kubeconfig: '/guest/config a:/guest/config b', context: 'selected' });

        const invocation = execute.firstCall.args[0];
        assert.strictEqual(invocation.executable, 'C:\\Windows\\System32\\wsl.exe');
        assert.deepStrictEqual(invocation.args, ['--exec', '/opt/Kube Tools/kubectl', '--context', 'selected', 'get', 'namespaces']);
        assert.strictEqual(invocation.env?.KUBECONFIG, '/guest/config a:/guest/config b');
        assert.strictEqual(invocation.env?.WSLENV, 'EXISTING/u:OTHER:KUBECONFIG/u');
    });
});

function fakeShell(windows = false): Shell {
    return {
        isWindows: () => windows,
        isUnix: () => !windows,
        platform: () => windows ? Platform.Windows : Platform.Linux,
        home: () => process.env.HOME || process.cwd(),
        execOpts: () => ({ env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }),
        exec: async () => { throw new Error('Unexpected shell execution'); },
        execCore: async () => { throw new Error('Unexpected shell execution'); },
    } as unknown as Shell;
}
