import * as assert from 'assert';
import * as sinon from 'sinon';
import { CancellationTokenSource, window, workspace, Uri, debug, DebugConfiguration, DebugSession as VSCodeDebugSession } from 'vscode';
import type { WorkspaceFolder } from 'vscode';
import nativeFs = require('fs');
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import type { ChildProcess } from 'child_process';
import { ExecResult, parseJSON } from '../../src/binutilplusplus';
import { Kubectl, create, createOnBinary } from '../../src/kubectl';
import * as autoversion from '../../src/components/kubectl/autoversion';
import * as processes from '../../src/process';
import * as shellModule from '../../src/shell';
import * as sleepModule from '../../src/sleep';
import { Host } from '../../src/host';
import { FS } from '../../src/fs';
import { Platform, Shell } from '../../src/shell';
import * as config from '../../src/components/config/config';
import { containerExecArgs, listPods, queryContainers, readPod } from '../../src/components/kubectl/pod-commands';
import { suggestedShellForContainer } from '../../src/utils/container-shell';
import { getProcesses } from '../../src/debug/debugUtils';
import { DebugSession } from '../../src/debug/debugSession';
import type { IDebugProvider } from '../../src/debug/debugProvider';
import { NodejsDebugProvider } from '../../src/debug/nodejsDebugProvider';
import { PythonDebugProvider } from '../../src/debug/pythonDebugProvider';
import { waitForPortForward } from '../../src/debug/portForward';
import { registerDebugSessionCleanup } from '../../src/debug/sessionCleanup';
import { DockerfileParser } from '../../src/docker/dockerfileParser';
import { findPodsByLabel, waitForRunningPod } from '../../src/kubectlUtils';
import { kubeChannel } from '../../src/kubeChannel';

const binary = { binBaseName: 'kubectl', configKeyName: 'kubectl', displayName: 'Kubectl', offersInstall: true };
function success(stdout: string): ExecResult {
    return { resultKind: 'exec-succeeded', execProgram: binary, command: 'test', stdout };
}
function fakeKubectl(invokeCommandArgs: sinon.SinonStub): Kubectl {
    return { invokeCommandArgs, parseJSON } as unknown as Kubectl;
}

suite('Pod and debug command security', () => {
    let sandbox: sinon.SinonSandbox;
    setup(() => { sandbox = sinon.createSandbox(); sandbox.stub(kubeChannel, 'showOutput'); });
    teardown(() => sandbox.restore());

    test('preserves the pod, namespace, container, and remote-command boundaries', () => {
        assert.deepStrictEqual(containerExecArgs('pod&marker', 'ns;marker', 'container$(marker)', ['sh', '-c', 'echo "$HOME"']), [
            'exec', 'pod/pod&marker', '--namespace=ns;marker', '--container=container$(marker)', '--', 'sh', '-c', 'echo "$HOME"',
        ]);
        assert.deepStrictEqual(containerExecArgs('-option', undefined, undefined, ['ps']), ['exec', 'pod/-option', '--', 'ps']);
    });

    test('runs the reported response-only container chain entirely through argv', async () => {
        const hostile = 'badcontainer&echo PROOF>marker&rem x';
        const invoke = sandbox.stub();
        invoke.onFirstCall().resolves(success(`${hostile}\timage:tag\n`));
        invoke.onSecondCall().resolves(success('/bin/bash'));
        const kubectl = fakeKubectl(invoke);
        const result = await queryContainers(kubectl, { kindName: 'pod/legitpod', namespace: 'ns', containersQueryPath: '.spec' }, 'containers');
        assert.ok(result.succeeded);
        if (!result.succeeded) { return; }
        assert.strictEqual(result.result[0].name, hostile);
        assert.strictEqual(await suggestedShellForContainer(kubectl, 'legitpod', 'ns', result.result[0].name), 'bash');
        assert.deepStrictEqual(invoke.secondCall.args[0], [
            'exec', 'pod/legitpod', '--namespace=ns', `--container=${hostile}`, '--', 'ls', '-la', '/bin/bash',
        ]);
    });

    test('keeps hostile resource names and namespaces in single discovery arguments', async () => {
        const invoke = sandbox.stub().resolves(success('app\timage:tag\r\n'));
        const result = await queryContainers(fakeKubectl(invoke), {
            kindName: 'job/job&marker', namespace: 'ns&marker', containersQueryPath: '.spec.template.spec',
        }, 'initContainers');
        assert.deepStrictEqual(invoke.firstCall.args[0], [
            'get', 'job/job&marker', '-o', 'jsonpath={range .spec.template.spec.initContainers[*]}{.name}{"\\t"}{.image}{"\\n"}{end}', '--namespace=ns&marker',
        ]);
        assert.ok(result.succeeded);
        if (result.succeeded) { assert.deepStrictEqual(result.result, [{ name: 'app', image: 'image:tag', initContainer: true }]); }
    });

    test('preserves empty container lists and discovery failures', async () => {
        const invoke = sandbox.stub().resolves(success(''));
        assert.deepStrictEqual(await queryContainers(fakeKubectl(invoke), {
            kindName: 'pod/p', namespace: undefined, containersQueryPath: '.spec',
        }, 'initContainers'), { succeeded: true, result: [] });
        invoke.resolves({ resultKind: 'exec-errored', execProgram: binary, command: 'get', code: 1, stderr: 'denied' });
        const result = await queryContainers(fakeKubectl(invoke), { kindName: 'pod/p', namespace: undefined, containersQueryPath: '.spec' }, 'containers');
        assert.strictEqual(result.succeeded, false);
    });

    test('falls back to sh when the bash probe fails', async () => {
        const invoke = sandbox.stub().resolves({ resultKind: 'exec-errored', execProgram: binary, command: 'exec', code: 1, stderr: 'not found' });
        assert.strictEqual(await suggestedShellForContainer(fakeKubectl(invoke), 'p', undefined, undefined), 'sh');
    });

    test('keeps selectors literal and validates the pod-list envelope', async () => {
        const invoke = sandbox.stub().resolves(success('{"items":[]}'));
        const kubectl = fakeKubectl(invoke);
        await findPodsByLabel(kubectl, 'app=x;$(marker)');
        assert.deepStrictEqual(invoke.firstCall.args[0], ['get', 'pods', '-o', 'json', '--selector=app=x;$(marker)']);
        await listPods(kubectl);
        assert.deepStrictEqual(invoke.secondCall.args[0], ['get', 'pods', '-o', 'json']);
        invoke.resolves(success('{"items":null}'));
        assert.strictEqual((await listPods(kubectl)).succeeded, false);
        invoke.resolves(success('not json'));
        assert.strictEqual((await listPods(kubectl)).succeeded, false);
    });

    test('rejects malformed pod rows before the picker accesses their fields', async () => {
        for (const pod of [null, {}, { metadata: { name: 'p' }, spec: { containers: [null] } }]) {
            const invoke = sandbox.stub().resolves(success(JSON.stringify({ items: [pod] })));
            const result = await listPods(fakeKubectl(invoke));
            assert.strictEqual(result.succeeded, false);
        }
    });

    test('reports a malformed single-pod response instead of crashing debug attach', async () => {
        sandbox.stub(window, 'showErrorMessage').resolves(undefined);
        const session = new DebugSession(fakeKubectl(sandbox.stub().resolves(success('null'))));
        assert.strictEqual(await session.getPodTarget('p', 'ns'), undefined);
    });

    test('accepts well-formed pod data without interpreting punctuation in identifiers', async () => {
        const pod = { metadata: { name: 'pod&marker', namespace: 'ns&marker' }, spec: { containers: [{ name: 'container&marker', image: 'image:tag' }] } };
        const invoke = sandbox.stub().resolves(success(JSON.stringify(pod)));
        const result = await readPod(fakeKubectl(invoke), pod.metadata.name, pod.metadata.namespace);
        assert.strictEqual(result.succeeded, true);
        assert.deepStrictEqual(invoke.firstCall.args[0], ['get', 'pod/pod&marker', '-o', 'json', '--namespace=ns&marker']);
        invoke.resolves(success(JSON.stringify({ items: [pod] })));
        assert.strictEqual((await listPods(fakeKubectl(invoke))).succeeded, true);
    });

    test('queries readiness and failure logs without shell strings', async () => {
        const invoke = sandbox.stub().resolves(success('p 1/1 Running 0 1m\n'));
        await waitForRunningPod(fakeKubectl(invoke), 'p&marker', 'ns&marker');
        assert.deepStrictEqual(invoke.firstCall.args[0], ['get', 'pod/p&marker', '--namespace=ns&marker', '--no-headers']);
        invoke.resetHistory();
        invoke.onFirstCall().resolves(success('p 0/1 Completed 0 1m\n'));
        invoke.onSecondCall().resolves(success('logs'));
        await assert.rejects(waitForRunningPod(fakeKubectl(invoke), 'p&marker', 'ns&marker'), /Completed/);
        assert.deepStrictEqual(invoke.secondCall.args[0], ['logs', 'pod/p&marker', '--namespace=ns&marker']);
    });

    test('does not treat a Running pod phase as a healthy container status', async () => {
        const invoke = sandbox.stub().callsFake(async (args: string[]) => {
            if (args[0] === 'logs') { return success('container failed'); }
            return success(args.includes('jsonpath={.status.phase}') ? 'Running' : 'p 0/1 CrashLoopBackOff 3 1m\n');
        });
        await assert.rejects(waitForRunningPod(fakeKubectl(invoke), 'p'), /CrashLoopBackOff/);
        assert.strictEqual(invoke.secondCall.args[0][0], 'logs');
    });

    test('keeps polling pending and initializing containers without querying logs', async () => {
        const sleep = sandbox.stub(sleepModule, 'sleep').resolves();
        const invoke = sandbox.stub();
        for (const [index, status] of ['Pending', 'ContainerCreating', 'Init:0/1', 'Running'].entries()) {
            invoke.onCall(index).resolves(success(`p 0/1 ${status} 0 1m\n`));
        }
        await waitForRunningPod(fakeKubectl(invoke), 'p');
        assert.strictEqual(sleep.callCount, 3);
        assert.strictEqual(invoke.callCount, 4);
        for (const call of invoke.args) { assert.strictEqual(call[0][0], 'get'); }
    });

    test('cancels readiness polling before issuing another query', async () => {
        const token = new CancellationTokenSource();
        token.cancel();
        const invoke = sandbox.stub();
        await assert.rejects(waitForRunningPod(fakeKubectl(invoke), 'p', undefined, token.token));
        sinon.assert.notCalled(invoke);
        token.dispose();
    });

    test('does not fetch failure logs after cancellation during the status query', async () => {
        const token = new CancellationTokenSource();
        const invoke = sandbox.stub().callsFake(async () => { token.cancel(); return success('Failed'); });
        await assert.rejects(waitForRunningPod(fakeKubectl(invoke), 'p', undefined, token.token));
        sinon.assert.calledOnce(invoke);
        token.dispose();
    });

    test('preserves process-list parsing while names remain arguments', async () => {
        const invoke = sandbox.stub().resolves(success('PID COMMAND\n1 node app.js\n22 sh\n'));
        assert.deepStrictEqual(await getProcesses(fakeKubectl(invoke), 'p&marker', 'ns', 'c'), [{ pid: 1, command: 'node app.js' }, { pid: 22, command: 'sh' }]);
        assert.deepStrictEqual(invoke.firstCall.args[0], containerExecArgs('p&marker', 'ns', 'c', ['ps', '-o', 'pid,command', '-e', '-w', '-w']));
    });

    test('only sends fixed debug scripts to the remote shell', async () => {
        const invoke = sandbox.stub().resolves(success('/app\n'));
        const kubectl = fakeKubectl(invoke);
        const node = new NodejsDebugProvider();
        node.shell = 'sh';
        await node.setNodeInspectMode(kubectl, 'p&marker', 'ns', 'c');
        assert.deepStrictEqual(invoke.firstCall.args[0], containerExecArgs('p&marker', 'ns', 'c', ['sh', '-c', 'kill -s USR1 1']));
        sandbox.stub(config, 'getNodejsAutoDetectRemoteRoot').returns(true);
        sandbox.stub(config, 'getPythonAutoDetectRemoteRoot').returns(true);
        assert.strictEqual(await node.tryGetRemoteRoot(kubectl, 'p', 'ns', 'c'), '/app');
        const python = new PythonDebugProvider();
        python.shell = 'sh';
        assert.strictEqual(await python.tryGetRemoteRoot(kubectl, 'p', 'ns', 'c'), '/app');
        assert.deepStrictEqual(invoke.lastCall.args[0], containerExecArgs('p', 'ns', 'c', ['sh', '-c', 'readlink /proc/1/cwd']));
    });

    test('waits for a split port-forward readiness message then drains output', async () => {
        const child = fakeChild();
        const ready = waitForPortForward(child as unknown as ChildProcess, ['8080:80']);
        child.stdout.write('Forwarding from 127.');
        child.stdout.write('0.0.1:8080 -> 80\n');
        await ready;
        assert.strictEqual(child.stdout.listenerCount('data'), 0);
        child.emit('close', 0, null);
        assert.strictEqual(child.stderr.listenerCount('data'), 0);
        assert.strictEqual(child.listenerCount('error'), 0);
    });

    test('recognizes readiness before truncating a large output chunk', async () => {
        const child = fakeChild();
        const ready = waitForPortForward(child as unknown as ChildProcess, ['8080:80']);
        child.stdout.write('Forwarding from 127.0.0.1:8080 -> 80\n' + 'x'.repeat(8192));
        await ready;
        child.emit('close', 0, null);
    });

    test('waits for every mapping without counting IPv4 and IPv6 twice', async () => {
        const child = fakeChild();
        let resolved = false;
        const ready = waitForPortForward(child as unknown as ChildProcess, ['8080:80', '9229:9229']).then(() => { resolved = true; });
        child.stdout.write('Forwarding from 127.0.0.1:8080 -> 80\nForwarding from [::1]:8080 -> 80\n');
        await Promise.resolve();
        assert.strictEqual(resolved, false);
        child.stdout.write('Forwarding from [::1]:9229 -> 9229\n');
        await ready;
        child.emit('close', 0, null);
    });

    test('rejects a bind failure after another mapping is already forwarding', async () => {
        const child = fakeChild();
        const ready = waitForPortForward(child as unknown as ChildProcess, ['8080:80', '9229:9229']);
        child.stdout.write('Forwarding from 127.0.0.1:8080 -> 80\n');
        child.stderr.write('Unable to listen on po');
        child.stderr.write('rt 9229: address already in use\n');
        await assert.rejects(ready, /9229/);
        sinon.assert.calledOnce(child.kill);
        child.emit('close', 1, null);
    });

    test('ignores unrelated debug sessions and cleans up its own launch once', () => {
        let terminate!: (session: VSCodeDebugSession) => void;
        const dispose = sandbox.stub();
        sandbox.stub(debug, 'onDidTerminateDebugSession').callsFake((listener) => {
            terminate = listener;
            return { dispose };
        });
        const configuration: DebugConfiguration = { type: 'node', request: 'attach', name: 'Attach to Process' };
        const onCleanup = sandbox.stub();
        const cleanup = registerDebugSessionCleanup(configuration, onCleanup);
        terminate({ configuration: { ...configuration, kubernetesLaunchId: 'unrelated' } } as unknown as VSCodeDebugSession);
        sinon.assert.notCalled(onCleanup);
        terminate({ configuration } as VSCodeDebugSession);
        cleanup();
        sinon.assert.calledOnce(onCleanup);
        sinon.assert.calledOnce(dispose);
    });

    test('waits for close when cancellation races with a startup error without killing an unspawned child', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const child = fakeChild();
        sandbox.stub(processes, 'spawnCommand').returns(child as unknown as ChildProcess);
        const shell = { isWindows: () => false, execOpts: () => ({}) } as unknown as Shell;
        const kubectl = createOnBinary({} as Host, {} as FS, shell, '/selected/kubectl');
        try {
            let completed = false;
            const pending = kubectl.spawnCommandArgs(['get', 'pods']).then((result) => { completed = true; return result; });
            await new Promise<void>((resolve) => setImmediate(resolve));
            kubectl.dispose();
            child.emit('error', new Error('ENOENT'));
            await Promise.resolve();
            assert.strictEqual(completed, false);
            sinon.assert.notCalled(child.kill);
            child.emit('close', -1, null);
            assert.strictEqual((await pending).resultKind, 'exec-failed');
            sinon.assert.notCalled(child.kill);
        } finally {
            kubectl.dispose();
        }
    });

    test('reports process errors after readiness instead of silently ignoring them', async () => {
        const child = fakeChild();
        const ready = waitForPortForward(child as unknown as ChildProcess, ['8080:80']);
        child.stdout.write('Forwarding from 127.0.0.1:8080 -> 80\n');
        await ready;
        child.emit('error', new Error('connection failed'));
        sinon.assert.calledWith(kubeChannel.showOutput as sinon.SinonStub, 'connection failed', 'port-forward');
        child.emit('close', 1, null);
    });

    test('cleans up forwarding when the debug provider rejects startup', async () => {
        const session = new DebugSession(fakeKubectl(sandbox.stub()));
        session['debugProvider'] = { startDebugging: sandbox.stub().rejects(new Error('provider failed')) } as unknown as IDebugProvider;
        const cleanup = sandbox.stub().resolves(undefined);
        await assert.rejects(session['startDebugging']('/workspace', 'session', 9229, undefined, 'p', undefined, cleanup), /provider failed/);
        sinon.assert.calledOnce(cleanup);
    });

    test('prompts for deployment cleanup only once when launch startup rejects', async () => {
        const session = new DebugSession(fakeKubectl(sandbox.stub()));
        const internals = session as unknown as {
            buildContainerImage(): Promise<string>;
            runAsDeployment(): Promise<string>;
            findDebugPod(): Promise<string>;
            waitForPod(): Promise<void>;
            setupPortForward(): Promise<{ proxyProcess: ChildProcess; proxyDebugPort: number; proxyAppPort: number }>;
            promptForCleanup(resource: string): Promise<void>;
        };
        const child = fakeChild();
        sandbox.stub(nativeFs, 'existsSync').returns(true);
        sandbox.stub(DockerfileParser.prototype, 'parse').returns({} as ReturnType<DockerfileParser['parse']>);
        sandbox.stub(workspace, 'getConfiguration').returns({ get: () => 'registry/team' } as unknown as ReturnType<typeof workspace.getConfiguration>);
        sandbox.stub(shellModule.shell, 'execOpts').returns({});
        sandbox.stub(internals, 'buildContainerImage').resolves('registry/team/app:tag');
        sandbox.stub(internals, 'runAsDeployment').resolves('app-debug');
        sandbox.stub(internals, 'findDebugPod').resolves('p');
        sandbox.stub(internals, 'waitForPod').resolves();
        sandbox.stub(internals, 'setupPortForward').resolves({ proxyProcess: child as unknown as ChildProcess, proxyDebugPort: 9229, proxyAppPort: 8080 });
        const cleanup = sandbox.stub(internals, 'promptForCleanup').resolves();
        sandbox.stub(window, 'showErrorMessage').resolves(undefined);
        const token = new CancellationTokenSource();
        const progress = sandbox.stub(window, 'withProgress').callsFake(async (_options, task) => task({ report: () => {} }, token.token));
        try {
            const provider = {
                isDebuggerInstalled: async () => true,
                resolvePortsFromFile: async () => ({ debugPort: 9229, appPort: 8080 }),
                getDebugArgs: async () => ({ cancelled: false }),
                getDebuggerType: () => 'node',
                startDebugging: async () => { throw new Error('provider failed'); },
            } as unknown as IDebugProvider;
            await session.launch({ uri: Uri.file('/workspace'), name: 'test', index: 0 } as WorkspaceFolder, provider);
            await progress.firstCall.returnValue;
            sinon.assert.calledOnceWithExactly(cleanup, 'deployment/app-debug');
            sinon.assert.calledOnce(child.kill);
        } finally {
            token.dispose();
        }
    });

    test('detects a background authentication URL before a long partial-line suffix', () => {
        const clock = sandbox.useFakeTimers();
        const warning = sandbox.stub(window, 'showWarningMessage').resolves(undefined);
        const child = fakeChild();
        shellModule.monitorForAuthPrompt(child as unknown as ChildProcess);
        child.stderr.write('https://microsoft.com/devicelogin ' + 'x'.repeat(8192));
        sinon.assert.calledOnce(warning);
        child.stderr.write('\n');
        sinon.assert.calledOnce(warning);
        clock.tick(1000);
    });

    test('rejects native Windows command scripts without a shell fallback', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const shell = { isWindows: () => true, isUnix: () => false } as Shell;
        for (const extension of ['cmd', 'BAT']) {
            const kubectl = createOnBinary({} as Host, {} as FS, shell, `C:\\Tools\\kubectl.${extension}`);
            const result = await kubectl.spawnCommandArgs(['get', 'pods']);
            assert.strictEqual(result.resultKind, 'exec-failed');
            if (result.resultKind === 'exec-failed') { assert.ok(result.error?.includes('.exe')); }
            kubectl.dispose();
        }
    });

    test('reports port-forward errors and exit before readiness', async () => {
        for (const event of ['error', 'close']) {
            const child = fakeChild();
            const ready = waitForPortForward(child as unknown as ChildProcess, ['8080:80']);
            child.emit(event, event === 'error' ? new Error('spawn failed') : 1);
            await assert.rejects(ready);
            sinon.assert.called(child.kill);
            if (event === 'error') { child.emit('close', 1, null); }
        }
    });

    test('cancels port forwarding while waiting and after readiness', async () => {
        for (const started of [false, true]) {
            const child = fakeChild();
            const token = new CancellationTokenSource();
            const ready = waitForPortForward(child as unknown as ChildProcess, ['8080:80'], token.token);
            if (started) {
                child.stdout.write('Forwarding from [::1]:8080 -> 80\n');
                await ready;
            }
            token.cancel();
            if (!started) { await assert.rejects(ready, /cancelled/); }
            sinon.assert.called(child.kill);
            child.emit('close', 0, null);
            token.dispose();
        }
    });

    test('cleans up listeners for an already-exited process even with a cancelled token', async () => {
        const child = fakeChild();
        child.exitCode = 1;
        const source = new CancellationTokenSource();
        source.cancel();
        try {
            await assert.rejects(waitForPortForward(child as unknown as ChildProcess, ['8080:80'], source.token));
            assert.strictEqual(child.stdout.listenerCount('data'), 0);
            assert.strictEqual(child.stderr.listenerCount('data'), 0);
            assert.strictEqual(child.listenerCount('error'), 0);
            assert.strictEqual(child.listenerCount('close'), 0);
        } finally {
            source.dispose();
        }
    });

    test('does not start a background process after shutdown during executable selection', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        let selectExecutable: ((path: string) => void) | undefined;
        sandbox.stub(autoversion, 'ensureSuitableKubectl').returns(new Promise<string>((resolve) => { selectExecutable = resolve; }));
        const child = fakeChild();
        const spawn = sandbox.stub(processes, 'spawnCommand').callsFake(() => {
            queueMicrotask(() => child.emit('spawn'));
            return child as unknown as ChildProcess;
        });
        const shell = { isWindows: () => false, execOpts: () => ({}) } as unknown as Shell;
        const kubectl = create(config.KubectlVersioning.Infer, {} as Host, {} as FS, shell);
        try {
            const pending = kubectl.spawnCommandArgs(['port-forward', 'pod/p', '8080:80']);
            await new Promise<void>((resolve) => setImmediate(resolve));
            assert.ok(selectExecutable);
            kubectl.dispose();
            selectExecutable('/selected/kubectl');
            const result = await pending;
            assert.strictEqual(result.resultKind, 'exec-failed');
            sinon.assert.notCalled(spawn);
        } finally {
            kubectl.dispose();
        }
    });

    test('handles shutdown during startup, before ownership transfer, and while running', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const spawn = sandbox.stub(processes, 'spawnCommand');
        for (const stage of ['starting', 'ownership', 'running']) {
            const child = fakeChild();
            const shell = { isWindows: () => false, execOpts: () => ({}) } as unknown as Shell;
            const kubectl = createOnBinary({} as Host, {} as FS, shell, '/selected/kubectl');
            spawn.callsFake(() => {
                if (stage !== 'starting') {
                    queueMicrotask(() => {
                        child.emit('spawn');
                        if (stage === 'ownership') { kubectl.dispose(); }
                    });
                }
                return child as unknown as ChildProcess;
            });
            try {
                const pending = kubectl.spawnCommandArgs(['port-forward', 'pod/p', '8080:80']);
                if (stage === 'starting') {
                    await new Promise<void>((resolve) => setImmediate(resolve));
                    kubectl.dispose();
                    sinon.assert.notCalled(child.kill);
                    child.emit('spawn');
                    child.emit('close', 0, null);
                }
                if (stage === 'ownership') {
                    let completed = false;
                    void pending.then(() => { completed = true; });
                    await new Promise<void>((resolve) => setImmediate(resolve));
                    assert.strictEqual(completed, false);
                    child.emit('close', 0, null);
                }
                const result = await pending;
                assert.strictEqual(result.resultKind, stage === 'running' ? 'exec-child-process-started' : 'exec-failed');
                if (stage === 'running') { kubectl.dispose(); }
                sinon.assert.calledOnce(child.kill);
                child.emit('close', 0, null);
            } finally {
                kubectl.dispose();
            }
        }
    });

    test('preserves authentication-prompt monitoring for background commands', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const monitor = sandbox.spy(shellModule, 'monitorForAuthPrompt');
        const child = fakeChild();
        sandbox.stub(processes, 'spawnCommand').callsFake(() => {
            queueMicrotask(() => child.emit('spawn'));
            return child as unknown as ChildProcess;
        });
        const shell = { isWindows: () => false, execOpts: () => ({}) } as unknown as Shell;
        const kubectl = createOnBinary({} as Host, {} as FS, shell, '/selected/kubectl');
        try {
            await kubectl.spawnCommandArgs(['port-forward', 'pod/p', '8080:80']);
            sinon.assert.calledOnce(monitor);
            assert.strictEqual(monitor.firstCall.args[0], child);
            child.emit('close', 0, null);
        } finally {
            kubectl.dispose();
        }
    });

    test('reports native background startup errors instead of emitting unhandled errors', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const shell = {
            isWindows: () => process.platform === 'win32', isUnix: () => process.platform !== 'win32',
            platform: () => process.platform === 'win32' ? Platform.Windows : Platform.Linux,
            execOpts: () => ({ env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }),
        } as unknown as Shell;
        const kubectl = createOnBinary({} as Host, {} as FS, shell, '/missing-debug-kubectl/kubectl');
        const result = await kubectl.spawnCommandArgs(['get', 'pods']);
        assert.strictEqual(result.resultKind, 'exec-failed');
        kubectl.dispose();
    });
});

function fakeChild() {
    return Object.assign(new EventEmitter(), {
        pid: 123,
        stdout: new PassThrough(), stderr: new PassThrough(), kill: sinon.stub().returns(true),
        exitCode: null as number | null, signalCode: null as NodeJS.Signals | null,
    });
}
