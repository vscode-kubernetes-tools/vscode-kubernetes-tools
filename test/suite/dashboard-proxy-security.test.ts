import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { Kubectl } from '../../src/kubectl';
import { Pod } from '../../src/kuberesources.objectmodel';
import { disposeProxySessions, initialiseProxyLifecycle, proxy, startForwardingProcess } from '../../src/components/kubectl/proxy';
import { dashboardKubernetes, dashboardPodInfo } from '../../src/components/kubectl/dashboard';
import * as browser from '../../src/components/platform/browser';

suite('Dashboard and proxy process security', () => {
    let sandbox: sinon.SinonSandbox;
    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
        sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
        sandbox.stub(browser, 'open');
    });
    teardown(() => { disposeProxySessions(); sandbox.restore(); });

    function child() {
        const process = Object.assign(new EventEmitter(), {
            pid: 12345, exitCode: null as number | null, signalCode: null,
            stdout: new PassThrough(), stderr: new PassThrough(), stdin: new PassThrough(), kill: sinon.stub().returns(true),
        });
        process.kill.callsFake(() => { process.exitCode = 0; process.emit('close', 0); return true; });
        return process;
    }

    function fixture() {
        const process = child();
        const spawn = sinon.stub().resolves({ resultKind: 'exec-child-process-started', childProcess: process });
        const kubectl = { spawnCommandArgs: spawn } as unknown as Kubectl;
        return { process, spawn, kubectl };
    }

    test('proxy uses loopback argv and accepts readiness split across chunks', async () => {
        const f = fixture();
        const pending = proxy(f.kubectl, 'random');
        await new Promise((resolve) => setImmediate(resolve));
        f.process.stdout.write('startup diagnostic\nStarting to ser');
        f.process.stdout.write('ve on 127.0.0.1:123');
        f.process.stdout.write('4\r\n');
        const result = await pending;
        assert.ok(result.succeeded);
        assert.strictEqual(result.result.port, 1234);
        assert.strictEqual(result.result.isActive, true);
        sinon.assert.calledOnceWithExactly(f.spawn, ['proxy', '--address=127.0.0.1', '--port=0']);
        result.result.dispose();
        await result.result.completed;
        assert.strictEqual(result.result.isActive, false);
    });

    test('reports startup failure, early exit stderr and invalid ports', async () => {
        const f = fixture();
        f.spawn.resolves({ resultKind: 'exec-failed', error: 'missing', execProgram: {}, command: '' });
        assert.strictEqual((await proxy(f.kubectl, 8001)).succeeded, false);
        assert.strictEqual((await proxy(f.kubectl, -1)).succeeded, false);
        f.spawn.resolves({ resultKind: 'exec-child-process-started', childProcess: f.process });
        const pending = proxy(f.kubectl, 8001);
        await new Promise((resolve) => setImmediate(resolve));
        f.process.stderr.write('address already in use');
        f.process.emit('close', 1);
        assert.deepStrictEqual(await pending, { succeeded: false, error: ['address already in use'] });
    });

    test('cancels readiness and a process returned after pending discovery', async () => {
        const f = fixture();
        let resolve!: (value: unknown) => void;
        f.spawn.returns(new Promise((done) => { resolve = done; }));
        const signal = new AbortController();
        const pending = proxy(f.kubectl, 'random', signal.signal);
        signal.abort();
        resolve({ resultKind: 'exec-child-process-started', childProcess: f.process });
        assert.strictEqual((await pending).succeeded, false);
        sinon.assert.calledOnce(f.process.kill);
    });

    test('timeout stops a process that never reports readiness', async () => {
        const f = fixture();
        const pending = startForwardingProcess(f.kubectl, ['proxy'], /ready:(\d+)\n/, undefined, 20);
        const result = await pending;
        assert.deepStrictEqual(result, { succeeded: false, error: ['Timed out starting Kubernetes forwarding.'] });
        sinon.assert.calledOnce(f.process.kill);
    });

    test('context lifecycle events terminate an active session', async () => {
        const f = fixture();
        const contextChanged = new vscode.EventEmitter<unknown>();
        const kubeconfigChanged = new vscode.EventEmitter<unknown>();
        const subscriptions: vscode.Disposable[] = [];
        initialiseProxyLifecycle({ subscriptions } as unknown as vscode.ExtensionContext, contextChanged.event, kubeconfigChanged.event);
        try {
            const pending = proxy(f.kubectl, 'random');
            await new Promise((resolve) => setImmediate(resolve));
            f.process.stdout.write('Starting to serve on 127.0.0.1:1234\n');
            const result = await pending;
            assert.ok(result.succeeded);
            contextChanged.fire(undefined);
            await result.result.completed;
            assert.strictEqual(result.result.isActive, false);
        } finally {
            subscriptions.forEach((subscription) => subscription.dispose());
            contextChanged.dispose(); kubeconfigChanged.dispose();
        }
    });

    test('Dashboard shares pending startup and reuses its owned proxy', async () => {
        const f = fixture();
        const read = sinon.stub().resolves({ succeeded: true, result: { items: [] } });
        Object.assign(f.kubectl, { asJsonArgs: read });
        const first = dashboardKubernetes(f.kubectl);
        const second = dashboardKubernetes(f.kubectl);
        await new Promise((resolve) => setImmediate(resolve));
        f.process.stdout.write('Starting to serve on 127.0.0.1:4567\n');
        await Promise.all([first, second]);
        await dashboardKubernetes(f.kubectl);
        sinon.assert.calledOnce(f.spawn);
        sinon.assert.calledOnceWithExactly(read, ['get', 'nodes', '-o', 'json']);
        assert.ok((browser.open as sinon.SinonStub).args.every(([url]) => url === 'http://127.0.0.1:4567/ui/'));
        const replacement = child();
        f.process.exitCode = 0;
        f.spawn.resolves({ resultKind: 'exec-child-process-started', childProcess: replacement });
        const restarted = dashboardKubernetes(f.kubectl);
        await new Promise((resolve) => setImmediate(resolve));
        replacement.stdout.write('Starting to serve on 127.0.0.1:5678\n');
        await restarted;
        sinon.assert.calledTwice(f.spawn);
        f.process.emit('close', 0);
    });

    test('AKS Dashboard forwards the validated pod with argv and waits for readiness', async () => {
        const f = fixture();
        const read = sinon.stub();
        read.onFirstCall().resolves({ succeeded: true, result: { items: [{ metadata: { name: 'aks-node', labels: { 'kubernetes.io/role': 'agent' } } }] } });
        read.onSecondCall().resolves({ succeeded: true, result: { items: [{ metadata: { name: 'dashboard' }, spec: { containers: [{ livenessProbe: { httpGet: { port: 8443, scheme: 'HTTPS' } } }] } }] } });
        Object.assign(f.kubectl, { asJsonArgs: read });
        const pending = dashboardKubernetes(f.kubectl);
        await new Promise((resolve) => setImmediate(resolve));
        sinon.assert.notCalled(browser.open as sinon.SinonStub);
        f.process.stdout.write('Forwarding from 127.0.0.1:4567 -> 8443\n');
        await pending;
        sinon.assert.calledOnceWithExactly(f.spawn, ['port-forward', 'pod/dashboard', '--namespace', 'kube-system', '--address=127.0.0.1', '0:8443']);
        sinon.assert.calledOnceWithExactly(browser.open as sinon.SinonStub, 'https://127.0.0.1:4567');
        assert.strictEqual(dashboardPodInfo({ metadata: { name: 'bad;$(marker)' } } as Pod), undefined);
        assert.strictEqual(dashboardPodInfo(undefined), undefined);
    });

    test('a context change during Dashboard discovery prevents launching', async () => {
        const f = fixture();
        let resolve!: (value: unknown) => void;
        Object.assign(f.kubectl, { asJsonArgs: sinon.stub().returns(new Promise((done) => { resolve = done; })) });
        const pending = dashboardKubernetes(f.kubectl);
        disposeProxySessions();
        resolve({ succeeded: true, result: { items: [] } });
        await pending;
        sinon.assert.notCalled(f.spawn);
        sinon.assert.notCalled(browser.open as sinon.SinonStub);
    });
});
