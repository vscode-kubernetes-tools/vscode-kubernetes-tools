import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { Kubectl } from '../../src/kubectl';
import { RunningProcess } from '../../src/binutilplusplus';
import { LogsPanel } from '../../src/components/logs/logsWebview';
import { getLogsForContainer, LogsDisplayMode } from '../../src/components/kubectl/logs';
import { getEvents, EventDisplayMode } from '../../src/components/kubectl/events';
import { LogsDestination } from '../../src/components/config/config';
import { logsArgs } from '../../src/components/kubectl/log-command';
import { ClusterExplorerResourceNode } from '../../src/components/clusterexplorer/node';

suite('Logs and Events argv security', () => {
    let sandbox: sinon.SinonSandbox;
    setup(() => { sandbox = sinon.createSandbox(); sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined); });
    teardown(() => sandbox.restore());

    function fixture() {
        let lease: RunningProcess | undefined;
        const addContent = sinon.stub();
        const panel = {
            addContent,
            setAppendContentProcess: (process: RunningProcess) => { lease?.terminate(); lease = process; },
            deleteAppendContentProcess: () => { lease?.terminate(); lease = undefined; },
        } as unknown as LogsPanel;
        const invoke = sinon.stub().resolves({ resultKind: 'exec-succeeded', stdout: 'literal logs' });
        const terminal = sinon.stub().resolves();
        const spawn = sinon.stub();
        const reportFailure = sinon.stub().resolves();
        const kubectl = { invokeCommandArgs: invoke, invokeArgsInOutputTerminal: terminal, spawnCommandArgs: spawn, reportFailure } as unknown as Kubectl;
        return { panel, addContent, invoke, terminal, spawn, kubectl, reportFailure };
    }

    test('terminal and one-shot webview share exact options and resource arguments', async () => {
        const f = fixture();
        const resource = 'pod/api;$(marker)';
        const args = ['logs', resource, '--namespace=all', '--container=worker', '--timestamps=true', '--since=1h30m', '--tail=12'];
        for (const destination of [LogsDestination.Terminal, LogsDestination.Webview]) {
            await getLogsForContainer(f.panel, f.kubectl, 'all', resource, 'worker', LogsDisplayMode.Show, true, '1h30m', 12, destination);
        }
        sinon.assert.calledOnceWithExactly(f.terminal, args, `Logs: ${resource}/worker`);
        sinon.assert.calledOnceWithExactly(f.invoke, args);
        sinon.assert.calledOnceWithExactly(f.addContent, 'literal logs');
    });

    test('rejects malformed webview options before execution', async () => {
        const f = fixture();
        for (const [container, since, tail] of [['--context victim', '0', -1], ['worker', '0;$(marker)', -1], ['worker', '0', NaN], ['worker', '0', -2]] as const) {
            await getLogsForContainer(f.panel, f.kubectl, 'team-a', 'pod/api', container, LogsDisplayMode.Show, false, since, tail, LogsDestination.Webview);
        }
        sinon.assert.notCalled(f.invoke);
        sinon.assert.notCalled(f.spawn);
        assert.strictEqual(logsArgs({ resource: 'pod/api', namespace: 'bad namespace', container: '', follow: false, timestamps: false, since: '0', tail: -1 }), undefined);
    });

    test('Events show and follow use argv and preserve namespace all', async () => {
        const f = fixture();
        const node = { name: 'all' } as ClusterExplorerResourceNode;
        await getEvents(f.kubectl, EventDisplayMode.Show, node);
        await getEvents(f.kubectl, EventDisplayMode.Follow, node);
        assert.deepStrictEqual(f.terminal.args, [
            [['get', 'events', '--namespace', 'all'], 'Kubernetes Events'],
            [['get', 'events', '--namespace', 'all', '-w'], 'Kubernetes Events'],
        ]);
        await getEvents(f.kubectl, EventDisplayMode.Show, { name: 'bad;$(marker)' } as ClusterExplorerResourceNode);
        sinon.assert.calledTwice(f.terminal);
    });

    function child() {
        return Object.assign(new EventEmitter(), { exitCode: null, signalCode: null, stdout: new PassThrough(), stderr: new PassThrough(), stdin: new PassThrough(), kill: sinon.stub().returns(true) });
    }

    test('follow preserves split UTF-8 output and stops on panel cancellation', async () => {
        const f = fixture();
        const process = child();
        f.spawn.resolves({ resultKind: 'exec-child-process-started', childProcess: process });
        await getLogsForContainer(f.panel, f.kubectl, 'team-a', 'pod/api', 'worker', LogsDisplayMode.Follow, false, '0', -1, LogsDestination.Webview);
        sinon.assert.calledOnceWithExactly(f.spawn, ['logs', 'pod/api', '--namespace=team-a', '--container=worker', '-f']);
        const bytes = Buffer.from('hello €');
        process.stdout.write(bytes.subarray(0, bytes.length - 1));
        process.stdout.write(bytes.subarray(bytes.length - 1));
        assert.strictEqual(f.addContent.args.map(([value]) => value).join(''), 'hello €');
        f.panel.deleteAppendContentProcess();
        process.stdout.write('ignored');
        process.emit('close', null);
        sinon.assert.calledOnce(process.kill);
        sinon.assert.notCalled(vscode.window.showErrorMessage as sinon.SinonStub);
    });

    test('Stop while a follow launch is pending terminates the late process', async () => {
        const f = fixture();
        const process = child();
        let resolve!: (value: unknown) => void;
        f.spawn.returns(new Promise((done) => { resolve = done; }));
        const pending = getLogsForContainer(f.panel, f.kubectl, 'team-a', 'pod/api', 'worker', LogsDisplayMode.Follow, false, '0', -1, LogsDestination.Webview);
        f.panel.deleteAppendContentProcess();
        resolve({ resultKind: 'exec-child-process-started', childProcess: process });
        await pending;
        sinon.assert.calledOnce(process.kill);
        process.emit('close', null);
        sinon.assert.notCalled(f.addContent);
    });

    test('switching to terminal output stops the existing webview follow', async () => {
        const f = fixture();
        const process = child();
        f.spawn.resolves({ resultKind: 'exec-child-process-started', childProcess: process });
        await getLogsForContainer(f.panel, f.kubectl, 'team-a', 'pod/api', '', LogsDisplayMode.Follow, false, '0', -1, LogsDestination.Webview);
        await getLogsForContainer(f.panel, f.kubectl, 'team-a', 'pod/api', '', LogsDisplayMode.Show, false, '0', -1, LogsDestination.Terminal);
        sinon.assert.calledOnce(process.kill);
        process.emit('close', null);
    });

    test('one-shot results from a superseded request do not overwrite current output', async () => {
        const f = fixture();
        let resolve!: (value: unknown) => void;
        f.invoke.returns(new Promise((done) => { resolve = done; }));
        const pending = getLogsForContainer(f.panel, f.kubectl, undefined, 'pod/api', '', LogsDisplayMode.Show, false, '0', -1, LogsDestination.Webview);
        f.panel.deleteAppendContentProcess();
        resolve({ resultKind: 'exec-succeeded', stdout: 'stale' });
        await pending;
        sinon.assert.notCalled(f.addContent);
    });

    test('follow reports structured startup failures and stderr on nonzero exit', async () => {
        const f = fixture();
        const failure = { resultKind: 'exec-failed', error: 'spawn failed' };
        f.spawn.resolves(failure);
        await getLogsForContainer(f.panel, f.kubectl, 'team-a', 'pod/api', '', LogsDisplayMode.Follow, false, '0', -1, LogsDestination.Webview);
        sinon.assert.calledOnceWithExactly(f.reportFailure, failure, { whatFailed: 'Follow logs failed' });
        const process = child();
        f.spawn.resolves({ resultKind: 'exec-child-process-started', childProcess: process });
        await getLogsForContainer(f.panel, f.kubectl, 'team-a', 'pod/api', '', LogsDisplayMode.Follow, false, '0', -1, LogsDestination.Webview);
        process.stderr.write('Forbidden');
        process.emit('close', 1);
        sinon.assert.calledOnceWithExactly(vscode.window.showErrorMessage as sinon.SinonStub, 'Follow logs failed: Forbidden');
    });
});
