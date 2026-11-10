import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { Kubectl } from '../../src/kubectl';
import { disposeProxySessions, initialiseProxyLifecycle, proxy, startForwardingProcess } from '../../src/components/kubectl/proxy';

suite('Proxy process security', () => {
    let sandbox: sinon.SinonSandbox;
    setup(() => { sandbox = sinon.createSandbox(); });
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

    test('uses loopback argv and accepts readiness split across chunks', async () => {
        const f = fixture();
        const pending = proxy(f.kubectl, 'random');
        await new Promise((resolve) => setImmediate(resolve));
        f.process.stdout.write('startup diagnostic\nStarting to ser');
        f.process.stdout.write('ve on 127.0.0.1:123');
        f.process.stdout.write('4\r\n');
        const result = await pending;
        assert.ok(result.succeeded);
        assert.strictEqual(result.result.port, 1234);
        sinon.assert.calledOnceWithExactly(f.spawn, ['proxy', '--address=127.0.0.1', '--port=0']);
        const closed = new Promise<void>((resolve) => f.process.once('close', () => resolve()));
        result.result.dispose();
        await closed;
        sinon.assert.calledOnce(f.process.kill);
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
            const closed = new Promise<void>((resolve) => f.process.once('close', () => resolve()));
            contextChanged.fire(undefined);
            await closed;
            sinon.assert.calledOnce(f.process.kill);
        } finally {
            subscriptions.forEach((subscription) => subscription.dispose());
            contextChanged.dispose();
            kubeconfigChanged.dispose();
        }
    });
});
