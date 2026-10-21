import * as assert from 'assert';
import * as sinon from 'sinon';
import { CancellationTokenSource, window } from 'vscode';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import type { ChildProcess } from 'child_process';
import { impl } from '../../src/api/implementation/kubectl/v2';
import { apiVersion } from '../../src/api/implementation/kubectl/versions';
import { KubectlV2 } from '../../src/api/contract/kubectl/v2';
import { PortForwardStatusBarManager } from '../../src/components/kubectl/port-forward-ui';
import * as config from '../../src/components/config/config';
import * as autoversion from '../../src/components/kubectl/autoversion';
import * as processes from '../../src/process';
import * as shellModule from '../../src/shell';
import { FS } from '../../src/fs';
import { Host } from '../../src/host';
import { kubeChannel } from '../../src/kubeChannel';
import { create, createOnBinary, Kubectl } from '../../src/kubectl';
import { Platform, Shell } from '../../src/shell';

suite('Kubectl V2 security', () => {
    let sandbox: sinon.SinonSandbox;
    let kubectl: Kubectl;
    let api: KubectlV2;

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(config, 'getEnableSnapFlag').returns(false);
        kubectl = createOnBinary({} as Host, {} as FS, fakeShell(), process.execPath);
        api = impl(kubectl);
    });

    teardown(() => {
        kubectl.dispose();
        sandbox.restore();
    });

    test('discovers V2 without changing V1 or unknown-version behavior', async () => {
        const legacyInvokeAsync = sandbox.stub().resolves({ code: 0, stdout: 'legacy', stderr: '' });
        const fakeKubectl = { legacyInvokeAsync } as unknown as Kubectl;
        const manager = {} as PortForwardStatusBarManager;
        const v1 = apiVersion(fakeKubectl, manager, 'v1');
        assert.strictEqual(v1.available, true);
        if (v1.available) {
            await v1.api.invokeCommand('get pods');
        }
        sinon.assert.calledOnceWithExactly(legacyInvokeAsync, 'get pods');
        assert.strictEqual(apiVersion(kubectl, manager, 'v2').available, true);
        assert.deepStrictEqual(apiVersion(kubectl, manager, 'v999'), { available: false, reason: 'version-unknown' });
    });

    test('passes hostile values unchanged, including empty arguments and whitespace', async () => {
        const values = ['pod&echo marker>file&rem x', '$(marker)', '`marker`', ';marker', '|marker', '%PATH%', '!PATH!', '"quoted"', "'quoted'", 'trailing\\', '', 'a\nb'];
        const args = ['-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', '--', ...values];
        const original = [...args];
        const result = await api.invokeCommand(args);
        assert.strictEqual(result.status, 'exited');
        if (result.status === 'exited') {
            assert.strictEqual(result.code, 0);
            assert.strictEqual(result.signal, null);
        }
        assert.deepStrictEqual(JSON.parse(result.stdout), values);
        assert.deepStrictEqual(args, original);
    });

    test('keeps successful stderr and failed stdout without trimming', async () => {
        for (const code of [0, 7]) {
            const result = await api.invokeCommand(['-e', `process.stdout.write(' out \\n');process.stderr.write(' err \\n');process.exitCode=${code}`]);
            assert.strictEqual(result.status, 'exited');
            if (result.status === 'exited') {
                assert.strictEqual(result.code, code);
            }
            assert.strictEqual(result.stdout, ' out \n');
            assert.strictEqual(result.stderr, ' err \n');
        }
    });

    test('sends stdin as data and closes it when no input is supplied', async () => {
        const script = 'process.stdin.on("data", c => process.stdout.write(c));process.stdin.on("end", () => process.stderr.write("closed"))';
        for (const stdin of [undefined, '', 'secret;$(marker)&%PATH%\n']) {
            const result = await api.invokeCommand(['-e', script], { stdin });
            assert.strictEqual(result.stdout, stdin ?? '');
            assert.strictEqual(result.stderr, 'closed');
        }
    });

    test('does not launch for pre-cancelled tokens', async () => {
        const source = new CancellationTokenSource();
        source.cancel();
        const execute = sandbox.spy(kubectl, 'executeCommandArgs');
        const result = await api.invokeCommand(['get', 'pods'], { cancellationToken: source.token });
        assert.strictEqual(result.status, 'cancelled');
        sinon.assert.notCalled(execute);
        source.dispose();
    });

    test('cancels a running process and closes its streams before resolving', async () => {
        const source = new CancellationTokenSource();
        const command = api.observeCommand(['-e', 'process.stdout.write("ready");setInterval(() => {}, 1000)'], { cancellationToken: source.token });
        let stdout = '';
        command.onStdout((chunk) => { stdout += chunk; source.cancel(); });
        assert.deepStrictEqual(await command.result, { status: 'cancelled' });
        assert.strictEqual(stdout, 'ready');
        command.dispose();
        command.dispose();
        source.dispose();
    });

    test('disposal cancels a running command', async () => {
        const command = api.observeCommand(['-e', 'process.stderr.write("ready");setInterval(() => {}, 1000)']);
        command.onStderr(() => command.dispose());
        assert.deepStrictEqual(await command.result, { status: 'cancelled' });
    });

    test('extension cleanup cancels its running commands and prevents new ones', async () => {
        const command = api.observeCommand(['-e', 'process.stdout.write("ready");setInterval(() => {}, 1000)']);
        command.onStdout(() => kubectl.dispose());
        assert.deepStrictEqual(await command.result, { status: 'cancelled' });
        assert.strictEqual((await api.invokeCommand(['-e', 'process.exit(0)'])).status, 'cancelled');
    });

    test('streams both outputs and returns a structured nonzero exit without retaining output', async () => {
        const command = api.observeCommand(['-e', 'process.stdout.write(" out ");process.stderr.write(" err ");process.exitCode=9']);
        let stdout = '';
        let stderr = '';
        command.onStdout((chunk) => { stdout += chunk; });
        command.onStderr((chunk) => { stderr += chunk; });
        assert.deepStrictEqual(await command.result, { status: 'exited', code: 9, signal: null });
        assert.strictEqual(stdout, ' out ');
        assert.strictEqual(stderr, ' err ');
    });

    test('preserves UTF-8 characters split across process writes', async () => {
        const script = 'const b=Buffer.from("😀");process.stdout.write(b.subarray(0,2));setTimeout(()=>process.stdout.write(b.subarray(2)),25)';
        assert.strictEqual((await api.invokeCommand(['-e', script])).stdout, '😀');
    });

    test('reports missing executables as structured failures', async () => {
        const missing = createOnBinary({} as Host, {} as FS, fakeShell(), '/no-such-kubectl-v2/kubectl');
        const result = await impl(missing).invokeCommand(['get', 'pods']);
        assert.strictEqual(result.status, 'failed');
        if (result.status === 'failed') {
            assert.strictEqual(result.reason, 'spawn-failed');
            assert.strictEqual(result.errorCode, 'ENOENT');
        }
        missing.dispose();
    });

    test('distinguishes signal termination from a normal exit', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        const result = await api.invokeCommand(['-e', 'process.kill(process.pid,"SIGTERM")']);
        assert.strictEqual(result.status, 'exited');
        if (result.status === 'exited') {
            assert.strictEqual(result.code, -1);
            assert.strictEqual(result.signal, 'SIGTERM');
        }
    });

    test('reports streaming startup failures through the result promise', async () => {
        const missing = createOnBinary({} as Host, {} as FS, fakeShell(), '/no-such-kubectl-v2/kubectl');
        const result = await impl(missing).observeCommand(['get', 'pods']).result;
        assert.strictEqual(result.status, 'failed');
        if (result.status === 'failed') {
            assert.strictEqual(result.errorCode, 'ENOENT');
        }
        missing.dispose();
    });

    test('bounds buffered stdout and stderr and reports which stream exceeded its limit', async () => {
        for (const stream of ['stdout', 'stderr']) {
            const result = await api.invokeCommand(['-e', `process.${stream}.write('x'.repeat(2048));setInterval(()=>{},1000)`], { maxBufferBytes: 1024 });
            assert.strictEqual(result.status, 'failed');
            if (result.status === 'failed') {
                assert.strictEqual(result.reason, 'output-limit');
                assert.ok(result.message.includes(stream));
            }
            assert.ok(Buffer.byteLength(result.stdout) <= 1024);
            assert.ok(Buffer.byteLength(result.stderr) <= 1024);
        }
    });

    test('bounds default output even when a child writes it all synchronously', async () => {
        const result = await api.invokeCommand(['-e', 'process.stdout.write("x".repeat(21*1024*1024));setInterval(()=>{},1000)']);
        assert.strictEqual(result.status, 'failed');
        if (result.status === 'failed') {
            assert.strictEqual(result.reason, 'output-limit');
        }
        assert.ok(Buffer.byteLength(result.stdout) <= 20 * 1024 * 1024);
    });

    test('does not apply buffered output limits to streaming commands', async () => {
        const command = api.observeCommand(['-e', 'process.stdout.write("x".repeat(4096))'], { maxBufferBytes: 1 });
        let length = 0;
        command.onStdout((chunk) => { length += chunk.length; });
        assert.deepStrictEqual(await command.result, { status: 'exited', code: 0, signal: null });
        assert.strictEqual(length, 4096);
    });

    test('rejects command strings, non-string arguments, NUL, and invalid output limits', async () => {
        const execute = sandbox.spy(kubectl, 'executeCommandArgs');
        for (const args of ['get pods', [null], ['a\0b']]) {
            assert.strictEqual((await api.invokeCommand(args as unknown as string[])).status, 'failed');
        }
        for (const maxBufferBytes of [0, -1, NaN, Infinity, 0.5]) {
            const result = await api.invokeCommand(['get'], { maxBufferBytes });
            assert.strictEqual(result.status, 'failed');
            if (result.status === 'failed') {
                assert.strictEqual(result.reason, 'invalid-argument');
            }
        }
        sinon.assert.notCalled(execute);
    });

    test('rejects sparse argument arrays before executing', async () => {
        const execute = sandbox.stub(kubectl, 'executeCommandArgs').resolves({ code: 0, stdout: '', stderr: '' });
        const result = await api.invokeCommand(new Array<string>(1));
        assert.strictEqual(result.status, 'failed');
        if (result.status === 'failed') {
            assert.strictEqual(result.reason, 'invalid-argument');
        }
        sinon.assert.notCalled(execute);
    });

    test('returns structured failures for null command options in both APIs', async () => {
        const options = null as unknown as KubectlV2.CommandOptions;
        const result = await api.invokeCommand(['get', 'pods'], options);
        assert.strictEqual(result.status, 'failed');
        const streaming = await api.observeCommand(['get', 'pods'], options).result;
        assert.strictEqual(streaming.status, 'failed');
    });

    test('keeps configured quoted and UNC Windows paths separate from arguments', async () => {
        const execute = sandbox.stub(processes, 'executeCommand').resolves({ code: 0, stdout: '', stderr: '' });
        for (const path of ['"C:\\Program Files\\Kube Tools\\kubectl.exe"', '\\\\server\\share name\\kubectl.exe']) {
            const selected = createOnBinary({} as Host, {} as FS, fakeShell(true), path);
            await impl(selected).invokeCommand(['get', 'pod/a&echo marker']);
            assert.strictEqual(execute.lastCall.args[0].executable, path.replace(/^"|"$/g, ''));
            assert.deepStrictEqual(execute.lastCall.args[0].args, ['get', 'pod/a&echo marker']);
            selected.dispose();
        }
    });

    test('rejects Windows .cmd and .bat wrappers without a shell fallback', async () => {
        const execute = sandbox.spy(processes, 'executeCommand');
        for (const path of ['C:\\Tools\\kubectl.cmd', '"C:\\Tools\\kubectl.BAT"']) {
            const selected = createOnBinary({} as Host, {} as FS, fakeShell(true), path);
            const result = await impl(selected).invokeCommand(['get', 'pods']);
            assert.strictEqual(result.status, 'failed');
            if (result.status === 'failed') {
                assert.strictEqual(result.reason, 'invalid-executable');
                assert.ok(result.message.includes('.exe'));
            }
            selected.dispose();
        }
        sinon.assert.notCalled(execute);
    });

    test('uses configured tool paths without shell-based discovery', async () => {
        sandbox.stub(config, 'getToolPath').returns(process.execPath);
        const shell = fakeShell();
        const legacyExec = sandbox.spy(shell, 'exec');
        const legacyExecCore = sandbox.spy(shell, 'execCore');
        const configured = create(config.KubectlVersioning.UserProvided, {} as Host, {} as FS, shell);
        const result = await impl(configured).invokeCommand(['-e', 'process.stdout.write("configured")']);
        assert.strictEqual(result.stdout, 'configured');
        sinon.assert.notCalled(legacyExec);
        sinon.assert.notCalled(legacyExecCore);
        configured.dispose();
    });

    test('uses an executable rather than a command-script wrapper for Windows PATH lookup', async () => {
        sandbox.stub(config, 'getToolPath').returns(undefined);
        const execute = sandbox.stub(processes, 'executeCommand').resolves({ code: 0, stdout: '', stderr: '' });
        const selected = create(config.KubectlVersioning.UserProvided, {} as Host, {} as FS, fakeShell(true));
        await impl(selected).invokeCommand(['get', 'pods']);
        assert.strictEqual(execute.firstCall.args[0].executable, 'kubectl.exe');
        selected.dispose();
    });

    test('uses the auto-versioned executable selected by the existing resolver', async () => {
        const resolver = sandbox.stub(autoversion, 'ensureSuitableKubectl').resolves(process.execPath);
        const selected = create(config.KubectlVersioning.Infer, {} as Host, {} as FS, fakeShell());
        const result = await impl(selected).invokeCommand(['-e', 'process.stdout.write("selected")']);
        assert.strictEqual(result.stdout, 'selected');
        sinon.assert.calledOnce(resolver);
        selected.dispose();
    });

    test('cancels during executable resolution without launching a process later', async () => {
        let finishSelection: ((path: string) => void) | undefined;
        sandbox.stub(autoversion, 'ensureSuitableKubectl').returns(new Promise<string>((resolve) => { finishSelection = resolve; }));
        const execute = sandbox.spy(processes, 'executeCommand');
        const selected = create(config.KubectlVersioning.Infer, {} as Host, {} as FS, fakeShell());
        const source = new CancellationTokenSource();
        const result = impl(selected).invokeCommand(['get', 'pods'], { cancellationToken: source.token });
        source.cancel();
        assert.strictEqual((await result).status, 'cancelled');
        assert.ok(finishSelection);
        finishSelection(process.execPath);
        await new Promise<void>((resolve) => setImmediate(resolve));
        sinon.assert.notCalled(execute);
        selected.dispose();
        source.dispose();
    });

    test('retains authentication-prompt monitoring', async () => {
        const monitor = sandbox.spy(shellModule, 'monitorForAuthPrompt');
        await api.invokeCommand(['-e', 'process.exit(0)']);
        sinon.assert.calledOnce(monitor);
    });

    test('keeps authentication detection bounded for streaming stderr without newlines', () => {
        const stderr = new PassThrough();
        const child = Object.assign(new EventEmitter(), { stderr });
        const showOutput = sandbox.stub(kubeChannel, 'showOutput');
        const warning = sandbox.stub(window, 'showWarningMessage').resolves(undefined);
        shellModule.monitorForAuthPrompt(child as unknown as ChildProcess);
        stderr.write('x'.repeat(1024 * 1024));
        stderr.write('https://microsoft.com/devicelogin\n');
        sinon.assert.calledOnce(warning);
        sinon.assert.calledOnce(showOutput);
        assert.ok(showOutput.firstCall.args[0].length < 5000);
        child.emit('exit', 1);
        stderr.destroy();
    });

    test('preserves buffered output received before cancellation', async () => {
        const source = new CancellationTokenSource();
        const monitor = sandbox.stub(shellModule, 'monitorForAuthPrompt').callsFake((child) => {
            child.stdout?.on('data', () => source.cancel());
        });
        const result = await api.invokeCommand(['-e', 'process.stdout.write("partial");setInterval(()=>{},1000)'], { cancellationToken: source.token });
        assert.strictEqual(result.status, 'cancelled');
        assert.strictEqual(result.stdout, 'partial');
        sinon.assert.calledOnce(monitor);
        source.dispose();
    });

    test('uses the safe Snap pipeline and preserves both outputs', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        (config.getEnableSnapFlag as sinon.SinonStub).returns(true);
        const result = await api.invokeCommand(['-e', 'process.stdout.write("snap");process.stderr.write("warning");process.exitCode=4']);
        assert.strictEqual(result.status, 'exited');
        if (result.status === 'exited') {
            assert.strictEqual(result.code, 4);
        }
        assert.strictEqual(result.stdout, 'snap');
        assert.strictEqual(result.stderr, 'warning');
    });

    test('forwards environment and cwd from the existing execution configuration', async () => {
        const shell = fakeShell();
        sandbox.stub(shell, 'execOpts').returns({ cwd: '/workspace folder', env: { KUBECONFIG: '/config path', CUSTOM: 'value' } });
        const selected = createOnBinary({} as Host, {} as FS, shell, '/usr/local/bin/kubectl');
        const execute = sandbox.stub(processes, 'executeCommand').resolves({ code: 0, stdout: '', stderr: '' });
        await impl(selected).invokeCommand(['get', 'pods']);
        assert.strictEqual(execute.firstCall.args[0].cwd, '/workspace folder');
        assert.deepStrictEqual(execute.firstCall.args[0].env, { KUBECONFIG: '/config path', CUSTOM: 'value' });
        selected.dispose();
    });

    test('launches WSL with --exec and preserves guest paths and arguments', async () => {
        (config.getUseWsl as sinon.SinonStub).returns(true);
        const execute = sandbox.stub(processes, 'executeCommand').resolves({ code: 0, stdout: '', stderr: '' });
        const selected = createOnBinary({} as Host, {} as FS, fakeShell(true), '/opt/Kube Tools/kubectl');
        await impl(selected).invokeCommand(['get', 'pod/a;$(marker)', '--namespace', 'team a']);
        assert.strictEqual(execute.firstCall.args[0].executable, 'wsl.exe');
        assert.deepStrictEqual(execute.firstCall.args[0].args, ['--exec', '/opt/Kube Tools/kubectl', 'get', 'pod/a;$(marker)', '--namespace', 'team a']);
        selected.dispose();
    });
});

function fakeShell(windows = false): Shell {
    return {
        isWindows: () => windows,
        isUnix: () => !windows,
        platform: () => windows ? Platform.Windows : Platform.Linux,
        execOpts: () => ({ env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }),
        exec: async () => { throw new Error('Unexpected shell execution'); },
        execCore: async () => { throw new Error('Unexpected shell execution'); },
    } as unknown as Shell;
}
