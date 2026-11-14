import * as assert from 'assert';
import * as sinon from 'sinon';
import * as path from 'path';
import * as vscode from 'vscode';
import { EventEmitter as NodeEventEmitter } from 'events';
import { PassThrough } from 'stream';
import type { ChildProcess } from 'child_process';
import {
    ClusterAccessGate, clusterAccess, isKubernetesCommand, noteExplicitUseWhenSettled
} from '../../../../src/components/clusteraccess/cluster-access';
import { BackgroundContextCache } from '../../../../src/components/contextmanager/background-context-cache';
import { ActiveValueTracker } from '../../../../src/components/contextmanager/active-value-tracker';
import { recommendExtensions } from '../../../../src/components/recommender/extension-recommender';
import * as explorer from '../../../../src/components/clusterexplorer/explorer';
import { ClusterExplorerNode } from '../../../../src/components/clusterexplorer/node';
import * as config from '../../../../src/components/config/config';
import * as kubectlUtils from '../../../../src/kubectlUtils';
import * as shellModule from '../../../../src/shell';
import * as telemetry from '../../../../src/telemetry';
import { invalidateClusterType, telemetrise } from '../../../../src/telemetry-helper';
import { Kubectl } from '../../../../src/kubectl';
import { Host } from '../../../../src/host';

const settled = () => new Promise((resolve) => setImmediate(resolve));

function configChange(...settings: string[]): vscode.ConfigurationChangeEvent {
    return { affectsConfiguration: (section: string) => settings.includes(section) };
}

function fakeContextTracker(contextName: string | null): ActiveValueTracker<string | null> {
    const emitter = new vscode.EventEmitter<string | null>();
    return {
        activeChanged: emitter.event,
        active: () => contextName,
        activeAsync: async () => contextName,
        setActive: () => undefined,
    };
}

suite('On-demand cluster connection: access gate', () => {
    test('allows background access in automatic mode', () => {
        assert.strictEqual(new ClusterAccessGate(() => false).isAllowed(), true);
    });

    test('blocks background access in on-demand mode until explicit use, then notifies once', () => {
        const gate = new ClusterAccessGate(() => true);
        const onAllow = sinon.spy();
        gate.onDidAllow(onAllow);

        assert.strictEqual(gate.isAllowed(), false);
        gate.noteExplicitUse();
        gate.noteExplicitUse();

        assert.strictEqual(gate.isAllowed(), true);
        sinon.assert.calledOnce(onAllow);
    });

    test('does not notify on explicit use when access was already allowed', () => {
        const gate = new ClusterAccessGate(() => false);
        const onAllow = sinon.spy();
        gate.onDidAllow(onAllow);

        gate.noteExplicitUse();

        sinon.assert.notCalled(onAllow);
    });

    test('notifies when the setting changes from on-demand to automatic', () => {
        let onDemand = true;
        const gate = new ClusterAccessGate(() => onDemand);
        const onAllow = sinon.spy();
        gate.onDidAllow(onAllow);

        onDemand = false;
        gate.onConfigurationChanged(configChange(config.CLUSTER_CONNECTION_SETTING));

        assert.strictEqual(gate.isAllowed(), true);
        sinon.assert.calledOnce(onAllow);
    });

    test('blocks again when switched to on-demand before any explicit use', () => {
        let onDemand = false;
        const gate = new ClusterAccessGate(() => onDemand);

        onDemand = true;
        gate.onConfigurationChanged(configChange(config.CLUSTER_CONNECTION_SETTING));

        assert.strictEqual(gate.isAllowed(), false);
    });

    test('ignores unrelated configuration changes', () => {
        let onDemand = true;
        const gate = new ClusterAccessGate(() => onDemand);
        const onAllow = sinon.spy();
        gate.onDidAllow(onAllow);

        onDemand = false;
        gate.onConfigurationChanged(configChange('vs-kubernetes'));

        sinon.assert.notCalled(onAllow);
    });
});

suite('On-demand cluster connection: explicit use detection', () => {
    test('counts Kubernetes commands but not Helm, Minikube or cloud explorer commands', () => {
        assert.strictEqual(isKubernetesCommand('extension.vsKubernetesGet'), true);
        assert.strictEqual(isKubernetesCommand('extension.helmTemplatePreview'), false);
        assert.strictEqual(isKubernetesCommand('extension.vsMinikubeStart'), false);
        assert.strictEqual(isKubernetesCommand('kubernetes.cloudExplorer.mergeIntoKubeconfig'), false);
    });

    test('does not count view refreshes, which other extensions trigger programmatically', () => {
        assert.strictEqual(isKubernetesCommand('extension.vsKubernetesRefreshExplorer'), false);
        assert.strictEqual(isKubernetesCommand('extension.vsKubernetesRefreshCloudExplorer'), false);
        assert.strictEqual(isKubernetesCommand('extension.vsKubernetesRefreshHelmRepoExplorer'), false);
    });

    test('notes explicit use only after the operation resolves and returns its result unchanged', async () => {
        const gate = new ClusterAccessGate(() => true);
        let finish: (value: string) => void = () => undefined;
        const operation = new Promise<string>((resolve) => { finish = resolve; });

        const returned = noteExplicitUseWhenSettled(operation, gate);
        await settled();
        assert.strictEqual(gate.isAllowed(), false);

        finish('done');
        assert.strictEqual(await returned, 'done');
        await settled();
        assert.strictEqual(gate.isAllowed(), true);
    });

    test('notes explicit use when the operation fails without swallowing the failure', async () => {
        const gate = new ClusterAccessGate(() => true);
        const operation = Promise.reject(new Error('sign-in failed'));

        await assert.rejects(noteExplicitUseWhenSettled(operation, gate), /sign-in failed/);
        await settled();
        assert.strictEqual(gate.isAllowed(), true);
    });

    test('notes explicit use for synchronous results', async () => {
        const gate = new ClusterAccessGate(() => true);

        assert.strictEqual(noteExplicitUseWhenSettled(42, gate), 42);
        await settled();
        assert.strictEqual(gate.isAllowed(), true);
    });
});

suite('On-demand cluster connection: Clusters view', () => {
    let sandbox: sinon.SinonSandbox;
    let noteExplicitUse: sinon.SinonStub;
    let tree: explorer.KubernetesExplorer;

    setup(() => {
        sandbox = sinon.createSandbox();
        noteExplicitUse = sandbox.stub(clusterAccess, 'noteExplicitUse');
        const host = { onDidChangeConfiguration: () => ({ dispose: () => undefined }) } as unknown as Host;
        tree = explorer.create({} as Kubectl, host);
    });
    teardown(() => sandbox.restore());

    test('listing contexts at the root does not count as explicit use', async () => {
        sandbox.stub(kubectlUtils, 'getContexts').resolves([]);

        await tree.getChildren(undefined);
        await settled();

        sinon.assert.notCalled(noteExplicitUse);
    });

    test('expanding a node counts as explicit use once its children load', async () => {
        const node = { getChildren: sandbox.stub().resolves([]) } as unknown as ClusterExplorerNode;

        await tree.getChildren(node);
        await settled();

        sinon.assert.calledOnce(noteExplicitUse);
    });
});

suite('On-demand cluster connection: YAML schema cache', () => {
    test('does not fetch while updates are blocked and serves the fallback', async () => {
        const fetch = sinon.stub().resolves('cluster schema');
        const cache = new BackgroundContextCache(fakeContextTracker('ctx'), fetch, 'fallback', () => false);

        assert.strictEqual(cache.active(), 'fallback');
        cache.invalidateActive();
        await settled();

        sinon.assert.notCalled(fetch);
        assert.strictEqual(cache.active(), 'fallback');
    });

    test('fetches the active context once updates are allowed and invalidated', async () => {
        let allowed = false;
        const fetch = sinon.stub().resolves('cluster schema');
        const cache = new BackgroundContextCache(fakeContextTracker('ctx'), fetch, 'fallback', () => allowed);

        allowed = true;
        cache.invalidateActive();
        await settled();

        sinon.assert.calledOnce(fetch);
        assert.strictEqual(cache.active(), 'cluster schema');
    });

    test('fetches on creation by default, as before', async () => {
        const fetch = sinon.stub().resolves('cluster schema');
        const cache = new BackgroundContextCache(fakeContextTracker('ctx'), fetch, 'fallback');
        await settled();

        sinon.assert.calledOnce(fetch);
        assert.strictEqual(cache.active(), 'cluster schema');
    });
});

suite('On-demand cluster connection: extension recommendations', () => {
    let sandbox: sinon.SinonSandbox;
    let allow: vscode.EventEmitter<void>;
    let kubectl: { invokeCommand: sinon.SinonStub };
    let context: vscode.ExtensionContext;

    setup(() => {
        sandbox = sinon.createSandbox();
        allow = new vscode.EventEmitter<void>();
        sandbox.replace(clusterAccess, 'onDidAllow', allow.event);
        sandbox.stub(config, 'ignoreK8sRecommendations').returns(false);
        sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
        kubectl = { invokeCommand: sandbox.stub().resolves({ resultKind: 'exec-succeeded', stdout: 'v1\n' }) };
        context = { extensionPath: path.resolve(__dirname, '../../../../..'), subscriptions: [] } as unknown as vscode.ExtensionContext;
    });
    teardown(() => {
        allow.dispose();
        sandbox.restore();
    });

    test('waits for explicit use before querying the cluster', async () => {
        sandbox.stub(clusterAccess, 'isAllowed').returns(false);

        await recommendExtensions(kubectl as unknown as Kubectl, context);
        sinon.assert.notCalled(kubectl.invokeCommand);

        (clusterAccess.isAllowed as sinon.SinonStub).returns(true);
        allow.fire();
        await settled();
        sinon.assert.calledOnceWithExactly(kubectl.invokeCommand, 'api-versions');
    });

    test('queries the cluster at activation in automatic mode, as before', async () => {
        sandbox.stub(clusterAccess, 'isAllowed').returns(true);

        await recommendExtensions(kubectl as unknown as Kubectl, context);

        sinon.assert.calledOnceWithExactly(kubectl.invokeCommand, 'api-versions');
    });
});

suite('On-demand cluster connection: telemetry', () => {
    const telemetryExports = telemetry as unknown as { reporter: unknown };
    let sandbox: sinon.SinonSandbox;
    let kubectl: { invokeCommand: sinon.SinonStub };
    let sendTelemetryEvent: sinon.SinonStub;
    let originalReporter: unknown;

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(config, 'isOnDemandClusterConnection').returns(true);
        kubectl = { invokeCommand: sandbox.stub().resolves({ resultKind: 'exec-errored', stderr: '' }) };
        sendTelemetryEvent = sandbox.stub();
        originalReporter = telemetryExports.reporter;
        telemetryExports.reporter = { sendTelemetryEvent };
    });
    teardown(() => {
        telemetryExports.reporter = originalReporter;
        sandbox.restore();
    });

    test('does not probe the cluster when the context changes', async () => {
        invalidateClusterType(undefined, kubectl as unknown as Kubectl);
        await settled();

        sinon.assert.notCalled(kubectl.invokeCommand);
    });

    test('reports commands without contacting the cluster', async () => {
        const callback = sandbox.stub().returns('result');

        const result = telemetrise('extension.vsKubernetesGet', kubectl as unknown as Kubectl, callback)('arg');
        await settled();

        assert.strictEqual(result, 'result');
        sinon.assert.calledOnceWithExactly(callback, 'arg');
        sinon.assert.notCalled(kubectl.invokeCommand);
        sinon.assert.calledOnceWithExactly(sendTelemetryEvent, 'command', {
            command: 'extension.vsKubernetesGet', clusterType: 'indeterminate', nonDeterminationReason: ''
        });
    });
});

suite('On-demand cluster connection: authentication warning', () => {
    let sandbox: sinon.SinonSandbox;
    let clock: sinon.SinonFakeTimers;
    let warning: sinon.SinonStub;
    let setOnDemand: sinon.SinonStub;

    function promptForSignIn(): void {
        const child = Object.assign(new NodeEventEmitter(), { stderr: new PassThrough() });
        shellModule.monitorForAuthPrompt(child as unknown as ChildProcess);
        child.stderr.write('To sign in, use a web browser to open https://microsoft.com/devicelogin\n');
    }

    setup(() => {
        sandbox = sinon.createSandbox();
        clock = sandbox.useFakeTimers({ toFake: ['setTimeout'] });
        warning = sandbox.stub(vscode.window, 'showWarningMessage');
        setOnDemand = sandbox.stub(config, 'setOnDemandClusterConnection').resolves();
    });
    teardown(() => {
        clock.tick(1000);
        sandbox.restore();
    });

    test('offers to switch to on-demand and applies it when chosen', async () => {
        sandbox.stub(config, 'isOnDemandClusterConnection').returns(false);
        warning.resolves(shellModule.CONNECT_ON_DEMAND_ACTION);

        promptForSignIn();
        await Promise.resolve();
        await Promise.resolve();

        sinon.assert.calledOnceWithExactly(warning, sinon.match.string, shellModule.CONNECT_ON_DEMAND_ACTION);
        sinon.assert.calledOnce(setOnDemand);
    });

    test('leaves the setting alone when the warning is dismissed', async () => {
        sandbox.stub(config, 'isOnDemandClusterConnection').returns(false);
        warning.resolves(undefined);

        promptForSignIn();
        await Promise.resolve();
        await Promise.resolve();

        sinon.assert.notCalled(setOnDemand);
    });

    test('does not offer the switch when already on-demand', () => {
        sandbox.stub(config, 'isOnDemandClusterConnection').returns(true);
        warning.resolves(undefined);

        promptForSignIn();

        sinon.assert.calledOnceWithExactly(warning, sinon.match.string);
    });
});
