import * as assert from 'assert';
import * as sinon from 'sinon';
import type { ConfigurationChangeEvent } from 'vscode';
import * as config from '../../src/components/config/config';
import { FS } from '../../src/fs';
import { Host } from '../../src/host';
import { create, createOnBinary } from '../../src/kubectl';
import { Platform, Shell } from '../../src/shell';
import * as processApi from '../../src/process';
import * as autoversion from '../../src/components/kubectl/autoversion';
import type { ProcessTerminalExecution } from '../../src/host';

suite('Kubectl terminal security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => sandbox.restore());

    test('uses the selected executable and shellArgs without mutation', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const args = ['exec', 'api-0', '--', '/bin/sh', '-c', 'echo "$HOME"; marker'];
        const original = [...args];
        const show = sinon.spy();
        const createTerminal = sinon.stub().returns({ show });
        const kubectl = createOnBinary(fakeHost(createTerminal), fakeFs(), fakeShell(false), '/opt/Kube Tools/kubectl');

        await kubectl.invokeArgsInNewTerminal(args, 'kubectl');

        assert.deepStrictEqual(args, original);
        sinon.assert.calledOnceWithExactly(
            createTerminal,
            'kubectl',
            '/opt/Kube Tools/kubectl',
            original,
            undefined
        );
        sinon.assert.calledOnce(show);
    });

    test('uses wsl.exe --exec for WSL', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const createTerminal = sinon.stub().returns({ show: sinon.spy() });
        const kubectl = createOnBinary(fakeHost(createTerminal), fakeFs(), fakeShell(false, { SystemRoot: 'C:\\Windows' }), '/usr/local/bin/kubectl');

        await kubectl.invokeArgsInNewTerminal(['get', 'pods', '--selector', 'app=$(marker)'], 'kubectl');

        sinon.assert.calledOnceWithExactly(
            createTerminal,
            'kubectl',
            'C:\\Windows\\System32\\wsl.exe',
            ['--exec', '/usr/local/bin/kubectl', 'get', 'pods', '--selector', 'app=$(marker)'],
            undefined
        );
    });

    test('runs short-lived output through a persistent process terminal', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const runProcessInTerminal = sinon.stub().resolves({ completed: Promise.resolve(), terminate: sinon.stub() });
        const createTerminal = sinon.stub();
        const kubectl = createOnBinary(
            fakeHost(createTerminal, undefined, undefined, runProcessInTerminal),
            fakeFs(),
            fakeShell(false, { PATH: '/usr/bin' }),
            '/opt/Kube Tools/kubectl'
        );
        const args = ['get', 'pod/api;$(marker)', '-o', 'wide'];

        await kubectl.invokeArgsInOutputTerminal(args, 'Kubernetes Get');

        assert.deepStrictEqual(args, ['get', 'pod/api;$(marker)', '-o', 'wide']);
        sinon.assert.calledOnceWithExactly(
            runProcessInTerminal,
            {
                name: 'Kubernetes Get',
                executable: '/opt/Kube Tools/kubectl',
                args,
                cwd: '/workspace',
                env: { PATH: '/usr/bin' },
            },
            sinon.match.has('aborted', false)
        );
        sinon.assert.notCalled(createTerminal);
    });

    test('runs WSL output terminals through the pinned system launcher', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const runProcessInTerminal = sinon.stub().resolves({ completed: Promise.resolve(), terminate: sinon.stub() });
        const kubectl = createOnBinary(
            fakeHost(sinon.stub(), undefined, undefined, runProcessInTerminal),
            fakeFs(),
            fakeShell(false, { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' }),
            '/usr/local/bin/kubectl'
        );

        await kubectl.invokeArgsInOutputTerminal(['cluster-info'], 'Kubernetes Cluster Info');

        sinon.assert.calledOnceWithExactly(
            runProcessInTerminal,
            {
                name: 'Kubernetes Cluster Info',
                executable: 'C:\\Windows\\System32\\wsl.exe',
                args: ['--exec', '/usr/local/bin/kubectl', 'cluster-info'],
                cwd: '/workspace',
                env: { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' },
            },
            sinon.match.has('aborted', false)
        );
    });

    test('reports output-terminal startup failures', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const runProcessInTerminal = sinon.stub().rejects(new Error('terminals unavailable'));
        const showErrorMessage = sinon.stub().resolves(undefined);
        const kubectl = createOnBinary(
            fakeHost(sinon.stub(), showErrorMessage, undefined, runProcessInTerminal),
            fakeFs(),
            fakeShell(false),
            '/usr/local/bin/kubectl'
        );

        await kubectl.invokeArgsInOutputTerminal(['cluster-info'], 'Kubernetes Cluster Info');

        sinon.assert.calledOnceWithExactly(
            showErrorMessage,
            'Unable to start kubectl output terminal: Error: terminals unavailable'
        );
    });

    test('cancels a pending output terminal on configuration changes without reporting an error', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        let configuredPath = '/first/kubectl';
        sandbox.stub(config, 'getToolPath').callsFake(() => configuredPath);
        let configurationChanged!: (event: ConfigurationChangeEvent) => void;
        let pendingSignal!: AbortSignal;
        let rejectLaunch!: (error: Error) => void;
        const runProcessInTerminal = sinon.stub().callsFake((_options: unknown, signal?: AbortSignal) => {
            pendingSignal = signal!;
            return new Promise<ProcessTerminalExecution>((_resolve, reject) => { rejectLaunch = reject; });
        });
        const showErrorMessage = sinon.stub().resolves(undefined);
        const kubectl = create(
            config.KubectlVersioning.UserProvided,
            fakeHost(sinon.stub(), showErrorMessage, (listener) => {
                configurationChanged = listener;
                return { dispose: sinon.stub() };
            }, runProcessInTerminal),
            fakeFs(),
            fakeShell(false)
        );

        const launch = kubectl.invokeArgsInOutputTerminal(['cluster-info'], 'Kubernetes Cluster Info');
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.strictEqual(pendingSignal.aborted, false);
        configuredPath = '/second/kubectl';
        configurationChanged({ affectsConfiguration: (section) => section === 'vscode-kubernetes.kubectl-path' });
        assert.strictEqual(pendingSignal.aborted, true);
        rejectLaunch(new Error('Process terminal launch cancelled.'));
        await launch;

        sinon.assert.notCalled(showErrorMessage);
        kubectl.dispose();
    });

    test('cancels a pending output terminal on disposal', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        let pendingSignal!: AbortSignal;
        let rejectLaunch!: (error: Error) => void;
        const runProcessInTerminal = sinon.stub().callsFake((_options: unknown, signal?: AbortSignal) => {
            pendingSignal = signal!;
            return new Promise<ProcessTerminalExecution>((_resolve, reject) => { rejectLaunch = reject; });
        });
        const showErrorMessage = sinon.stub().resolves(undefined);
        const kubectl = createOnBinary(
            fakeHost(sinon.stub(), showErrorMessage, undefined, runProcessInTerminal),
            fakeFs(),
            fakeShell(false),
            '/usr/local/bin/kubectl'
        );

        const launch = kubectl.invokeArgsInOutputTerminal(['cluster-info'], 'Kubernetes Cluster Info');
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.strictEqual(pendingSignal.aborted, false);
        kubectl.dispose();
        assert.strictEqual(pendingSignal.aborted, true);
        rejectLaunch(new Error('Process terminal launch cancelled.'));
        await launch;

        sinon.assert.notCalled(showErrorMessage);
    });

    test('terminates active output terminals on configuration changes and disposal', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        let configuredPath = '/usr/local/bin/kubectl';
        sandbox.stub(config, 'getToolPath').callsFake(() => configuredPath);
        let configurationChanged!: (event: ConfigurationChangeEvent) => void;
        let complete!: () => void;
        const terminate = sinon.stub();
        const runProcessInTerminal = sinon.stub().resolves({
            completed: new Promise<void>((resolve) => { complete = resolve; }),
            terminate,
        });
        const kubectl = create(
            config.KubectlVersioning.UserProvided,
            fakeHost(sinon.stub(), undefined, (listener) => {
                configurationChanged = listener;
                return { dispose: sinon.stub() };
            }, runProcessInTerminal),
            fakeFs(),
            fakeShell(false)
        );

        await kubectl.invokeArgsInOutputTerminal(['cluster-info'], 'Kubernetes Cluster Info');
        configuredPath = '/opt/kubectl';
        configurationChanged({ affectsConfiguration: (section) => section === 'vscode-kubernetes.kubectl-path' });
        sinon.assert.calledOnce(terminate);
        complete();
        await Promise.resolve();
        kubectl.dispose();
        sinon.assert.calledOnce(terminate);
    });

    test('does not start an output terminal after disposal during discovery', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(config, 'getToolPath').returns(undefined);
        let resolvePath!: (executable: string) => void;
        const pathSelection = new Promise<string>((resolve) => { resolvePath = resolve; });
        const runProcessInTerminal = sinon.stub();
        sandbox.stub(autoversion, 'ensureSuitableKubectl').returns(pathSelection);
        const autoKubectl = create(
            config.KubectlVersioning.Infer,
            fakeHost(sinon.stub(), undefined, undefined, runProcessInTerminal),
            fakeFs(),
            fakeShell(false)
        );

        const launch = autoKubectl.invokeArgsInOutputTerminal(['cluster-info'], 'Kubernetes Cluster Info');
        await new Promise<void>((resolve) => setImmediate(resolve));
        autoKubectl.dispose();
        resolvePath('/old/kubectl');
        await launch;

        sinon.assert.notCalled(runProcessInTerminal);
    });

    test('terminates an output terminal returned after a configuration race', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        let configuredPath = '/first/kubectl';
        sandbox.stub(config, 'getToolPath').callsFake(() => configuredPath);
        let configurationChanged!: (event: ConfigurationChangeEvent) => void;
        let returnExecution!: (execution: ProcessTerminalExecution) => void;
        const runProcessInTerminal = sinon.stub().returns(new Promise<ProcessTerminalExecution>((resolve) => { returnExecution = resolve; }));
        const terminate = sinon.stub();
        const kubectl = create(
            config.KubectlVersioning.UserProvided,
            fakeHost(sinon.stub(), undefined, (listener) => {
                configurationChanged = listener;
                return { dispose: sinon.stub() };
            }, runProcessInTerminal),
            fakeFs(),
            fakeShell(false)
        );

        const launch = kubectl.invokeArgsInOutputTerminal(['cluster-info'], 'Kubernetes Cluster Info');
        await new Promise<void>((resolve) => setImmediate(resolve));
        configuredPath = '/second/kubectl';
        configurationChanged({ affectsConfiguration: (section) => section === 'vscode-kubernetes.kubectl-path' });
        returnExecution({ completed: Promise.resolve(), terminate });
        await launch;

        sinon.assert.calledOnce(terminate);
        kubectl.dispose();
    });

    test('preserves an uppercase Windows executable suffix', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const createTerminal = sinon.stub().returns({ show: sinon.spy() });
        const kubectl = createOnBinary(fakeHost(createTerminal), fakeFs(), fakeShell(true), 'C:\\Tools\\KUBECTL.EXE');

        await kubectl.invokeArgsInNewTerminal(['port-forward', 'pods/api-0', '8080:8080'], 'kubectl');

        assert.strictEqual(createTerminal.firstCall.args[1], 'C:\\Tools\\KUBECTL.EXE');
    });

    test('reports configured Windows command scripts without launching a terminal', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const createTerminal = sinon.stub();
        const showErrorMessage = sinon.stub().resolves(undefined);
        const kubectl = createOnBinary(
            fakeHost(createTerminal, showErrorMessage),
            fakeFs(),
            fakeShell(true),
            'C:\\Tools\\kubectl.cmd'
        );

        await kubectl.invokeArgsInNewTerminal(['get', 'pods'], 'kubectl');

        sinon.assert.notCalled(createTerminal);
        sinon.assert.calledOnceWithExactly(
            showErrorMessage,
            "Cannot launch configured kubectl command script 'C:\\Tools\\kubectl.cmd' without a shell. Configure a kubectl.exe path instead."
        );
    });

    test('preserves the command-script reason for argv execution failures', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const kubectl = createOnBinary(
            fakeHost(sinon.stub()),
            fakeFs(),
            fakeShell(true),
            'C:\\Tools\\kubectl.cmd'
        );

        const result = await kubectl.invokeCommandArgs(['get', 'pods']);

        assert.strictEqual(result.resultKind, 'exec-failed');
        if (result.resultKind === 'exec-failed') {
            assert.strictEqual(
                result.error,
                "Configured Kubectl path 'C:\\Tools\\kubectl.cmd' is a command script; configure an .exe path for shell-free execution."
            );
        }
    });

    test('invalidates a discovered executable after configuration changes', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        let configuredPath = '/first/kubectl';
        sandbox.stub(config, 'getToolPath').callsFake(() => configuredPath);
        let configurationChanged!: (event: ConfigurationChangeEvent) => void;
        const disposeConfigurationListener = sinon.stub();
        const createTerminal = sinon.stub().returns({ show: sinon.stub(), dispose: sinon.stub() });
        const host = fakeHost(createTerminal, undefined, (listener) => {
            configurationChanged = listener;
            return { dispose: disposeConfigurationListener };
        });
        const kubectl = create(config.KubectlVersioning.UserProvided, host, fakeFs(), fakeShell(false));

        await kubectl.invokeArgsInNewTerminal(['get', 'pods'], 'first');
        configuredPath = '/second/kubectl';
        configurationChanged({ affectsConfiguration: (section) => section === 'vscode-kubernetes.kubectl-path' });
        await kubectl.invokeArgsInNewTerminal(['get', 'pods'], 'second');

        assert.deepStrictEqual(createTerminal.args.map((call) => call[1]), ['/first/kubectl', '/second/kubectl']);
        kubectl.dispose();
        sinon.assert.calledOnce(disposeConfigurationListener);
    });

    test('discards an in-flight auto-version selection when the active kubeconfig changes', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(config, 'getToolPath').returns(undefined);
        let activeKubeconfig = '/first/config';
        sandbox.stub(config, 'getActiveKubeconfig').callsFake(() => activeKubeconfig);
        let resolveOld!: (executable: string) => void;
        const oldSelection = new Promise<string>((resolve) => { resolveOld = resolve; });
        const select = sandbox.stub(autoversion, 'ensureSuitableKubectl');
        select.onFirstCall().returns(oldSelection);
        select.onSecondCall().resolves('/new/kubectl');
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: 'ok', stderr: '' });
        const configurationListeners: Array<(event: ConfigurationChangeEvent) => void> = [];
        const kubectl = create(
            config.KubectlVersioning.Infer,
            fakeHost(sinon.stub(), undefined, (listener) => {
                configurationListeners.push(listener);
                return { dispose: sinon.stub() };
            }),
            fakeFs(),
            fakeShell(false)
        );

        const launch = kubectl.invokeCommandArgs(['get', 'pods']);
        await new Promise<void>((resolve) => setImmediate(resolve));
        activeKubeconfig = '/second/config';
        configurationListeners.forEach((listener) => listener({ affectsConfiguration: (section) => section === 'vs-kubernetes' }));
        resolveOld('/old/kubectl');
        await launch;

        sinon.assert.calledTwice(select);
        sinon.assert.calledOnceWithExactly(execute, {
            executable: '/new/kubectl',
            args: ['get', 'pods'],
            cwd: '/workspace',
            env: {},
        }, undefined, sinon.match.func);
        kubectl.dispose();
    });

    test('discards an in-flight discovery result after configuration changes', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        let configuredPath = '/old/kubectl';
        sandbox.stub(config, 'getToolPath').callsFake(() => configuredPath);
        let configurationChanged!: (event: ConfigurationChangeEvent) => void;
        let resolveOld!: (exists: boolean) => void;
        const oldExists = new Promise<boolean>((resolve) => { resolveOld = resolve; });
        const existsAsync = sandbox.stub();
        existsAsync.withArgs('/old/kubectl').returns(oldExists);
        existsAsync.withArgs('/new/kubectl').resolves(true);
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: 'ok', stderr: '' });
        const host = fakeHost(sinon.stub(), undefined, (listener) => {
            configurationChanged = listener;
            return { dispose: sinon.stub() };
        });
        const kubectl = create(
            config.KubectlVersioning.UserProvided,
            host,
            { existsSync: () => true, existsAsync } as unknown as FS,
            fakeShell(false)
        );

        const launch = kubectl.invokeCommandArgs(['get', 'pods']);
        await new Promise<void>((resolve) => setImmediate(resolve));
        configuredPath = '/new/kubectl';
        configurationChanged({ affectsConfiguration: (section) => section === 'vscode-kubernetes.kubectl-path' });
        resolveOld(true);
        await launch;

        sinon.assert.calledOnceWithExactly(execute, {
            executable: '/new/kubectl',
            args: ['get', 'pods'],
            cwd: '/workspace',
            env: {},
        }, undefined, sinon.match.func);
        assert.deepStrictEqual(existsAsync.args.map((call) => call[0]), ['/old/kubectl', '/new/kubectl']);
        kubectl.dispose();
    });

    test('auto-versioned kubectl disposes its bootstrapper listener', () => {
        const disposeListeners = [sinon.stub(), sinon.stub()];
        const onDidChangeConfiguration = sinon.stub();
        onDidChangeConfiguration.onCall(0).returns({ dispose: disposeListeners[0] });
        onDidChangeConfiguration.onCall(1).returns({ dispose: disposeListeners[1] });
        const kubectl = create(
            config.KubectlVersioning.Infer,
            fakeHost(sinon.stub(), undefined, onDidChangeConfiguration),
            fakeFs(),
            fakeShell(false)
        );

        kubectl.dispose();

        sinon.assert.calledOnce(disposeListeners[0]);
        sinon.assert.calledOnce(disposeListeners[1]);
    });

    test('fixed binary wrappers do not register configuration listeners', () => {
        const onDidChangeConfiguration = sinon.stub();
        const kubectl = createOnBinary(
            fakeHost(sinon.stub(), undefined, onDidChangeConfiguration),
            fakeFs(),
            fakeShell(false),
            '/fixed/kubectl'
        );

        sinon.assert.notCalled(onDidChangeConfiguration);
        kubectl.dispose();
    });

    test('creates legacy terminals only after revision-stable discovery', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        let configuredPath = '/old/kubectl';
        sandbox.stub(config, 'getToolPath').callsFake(() => configuredPath);
        let configurationChanged!: (event: ConfigurationChangeEvent) => void;
        let resolveOld!: (result: processApi.ProcessResult) => void;
        const oldExists = new Promise<processApi.ProcessResult>((resolve) => { resolveOld = resolve; });
        const execute = sandbox.stub(processApi, 'executeCommand');
        execute.withArgs(sinon.match.hasNested('args[3]', '/old/kubectl')).returns(oldExists);
        execute.withArgs(sinon.match.hasNested('args[3]', '/new/kubectl')).resolves({ code: 0, stdout: '', stderr: '' });
        const sendText = sinon.stub();
        const createTerminal = sinon.stub().returns({ processId: Promise.resolve(1), sendText, show: sinon.stub(), dispose: sinon.stub() });
        const host = fakeHost(createTerminal, undefined, (listener) => {
            configurationChanged = listener;
            return { dispose: sinon.stub() };
        });
        const kubectl = create(
            config.KubectlVersioning.UserProvided,
            host,
            fakeFs(),
            fakeShell(false, { SystemRoot: 'C:\\Windows' })
        );

        const launch = kubectl.invokeInNewTerminal('get pods', 'kubectl');
        await new Promise<void>((resolve) => setImmediate(resolve));
        sinon.assert.notCalled(createTerminal);
        configuredPath = '/new/kubectl';
        configurationChanged({ affectsConfiguration: (section) => section === 'vscode-kubernetes.kubectl-path' });
        resolveOld({ code: 0, stdout: '', stderr: '' });
        await launch;

        sinon.assert.calledOnce(createTerminal);
        sinon.assert.calledOnceWithExactly(sendText, 'kubectl get pods');
        kubectl.dispose();
    });
});

function fakeHost(
    createTerminal: sinon.SinonStub,
    showErrorMessage: sinon.SinonStub = sinon.stub().resolves(undefined),
    onDidChangeConfiguration: Host['onDidChangeConfiguration'] = () => ({ dispose: () => {} }),
    runProcessInTerminal: Host['runProcessInTerminal'] = async () => ({ completed: Promise.resolve(), terminate: () => {} }) as ProcessTerminalExecution
): Host {
    return {
        createTerminal,
        runProcessInTerminal,
        onDidCloseTerminal: () => ({ dispose: () => {} }),
        onDidChangeConfiguration,
        showErrorMessage,
        showWarningMessage: async () => undefined,
        showInformationMessage: async () => undefined,
        showInputBox: async () => undefined,
        showQuickPick: async () => undefined,
        withProgress: async (task: any) => task({ report: () => {} }),
        getConfiguration: () => undefined,
        activeDocument: () => undefined,
        showDocument: async () => { throw new Error('unused'); },
        readDocument: async () => { throw new Error('unused'); },
        selectRootFolder: async () => undefined,
        longRunning: async (_options: any, action: any) => action(),
    } as unknown as Host;
}

function fakeFs(): FS {
    return { existsSync: () => true, existsAsync: async () => true } as unknown as FS;
}

function fakeShell(windows: boolean, env: NodeJS.ProcessEnv = {}): Shell {
    return {
        isWindows: () => windows,
        isUnix: () => !windows,
        platform: () => windows ? Platform.Windows : Platform.Linux,
        home: () => '',
        combinePath: () => '',
        fileUri: () => { throw new Error('unused'); },
        execOpts: () => ({ cwd: '/workspace', env }),
        exec: async () => undefined,
        execStreaming: async () => undefined,
        execCore: async () => ({ code: 0, stdout: '', stderr: '' }),
        unquotedPath: (value) => value,
        which: () => null,
        cat: () => '',
        ls: () => [],
    };
}
