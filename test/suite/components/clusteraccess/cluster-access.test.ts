import * as assert from 'assert';
import * as sinon from 'sinon';
import * as path from 'path';
import * as vscode from 'vscode';
import { EventEmitter as NodeEventEmitter } from 'events';
import { PassThrough } from 'stream';
import type { ChildProcess } from 'child_process';
import { Watch } from '@kubernetes/client-node';
import {
    ClusterAccessGate, clusterAccess, isKubernetesCommand
} from '../../../../src/components/clusteraccess/cluster-access';
import { BackgroundContextCache } from '../../../../src/components/contextmanager/background-context-cache';
import { ActiveValueTracker } from '../../../../src/components/contextmanager/active-value-tracker';
import { recommendExtensions } from '../../../../src/components/recommender/extension-recommender';
import * as config from '../../../../src/components/config/config';
import * as kubectlUtils from '../../../../src/kubectlUtils';
import * as explorer from '../../../../src/components/clusterexplorer/explorer';
import { ResourceFolderNode } from '../../../../src/components/clusterexplorer/node.folder.resource';
import { allKinds } from '../../../../src/kuberesources';
import { WatchManager } from '../../../../src/components/kubectl/watch';
import * as kubeconfig from '../../../../src/components/kubectl/kubeconfig';
import * as shellModule from '../../../../src/shell';
import * as telemetry from '../../../../src/telemetry';
import { invalidateClusterType, telemetrise } from '../../../../src/telemetry-helper';
import { Kubectl, create as createKubectl, createLocal } from '../../../../src/kubectl';
import { Host } from '../../../../src/host';
import { fs } from '../../../../src/fs';
import * as autoversion from '../../../../src/components/kubectl/autoversion';
import * as binutil from '../../../../src/binutil';
import { formatBin, vsKubernetesFolder } from '../../../../src/components/installer/installationlayout';
import * as processes from '../../../../src/process';
import * as swagger from '../../../../src/components/swagger/swagger';
import { KubernetesClusterSchemaHolder } from '../../../../src/yaml-support/schema-holder';
import { setAssetContext } from '../../../../src/assets';
import { FileBacked } from '../../../../src/utils/filebacked';

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

    test('ignores automatic-mode use when switching to on-demand', () => {
        let onDemand = false;
        const gate = new ClusterAccessGate(() => onDemand);
        const onAllow = sinon.spy();
        gate.onDidAllow(onAllow);

        gate.noteExplicitUse();
        sinon.assert.notCalled(onAllow);

        onDemand = true;
        gate.onConfigurationChanged(configChange(config.CLUSTER_CONNECTION_SETTING));
        assert.strictEqual(gate.isAllowed(), false);

        gate.noteExplicitUse();
        assert.strictEqual(gate.isAllowed(), true);
        sinon.assert.calledOnce(onAllow);
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

    test('requires new explicit use after switching out of on-demand and back', () => {
        let onDemand = true;
        const gate = new ClusterAccessGate(() => onDemand);
        const change = configChange(config.CLUSTER_CONNECTION_SETTING);
        gate.noteExplicitUse();

        onDemand = false;
        gate.onConfigurationChanged(change);
        assert.strictEqual(gate.isAllowed(), true);

        onDemand = true;
        gate.onConfigurationChanged(change);
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
});

suite('On-demand cluster connection: Clusters view', () => {
    let sandbox: sinon.SinonSandbox;
    let noteExplicitUse: sinon.SinonStub;
    let visibility: vscode.EventEmitter<vscode.TreeViewVisibilityChangeEvent>;
    let expansion: vscode.EventEmitter<vscode.TreeViewExpansionEvent<unknown>>;
    let allow: vscode.EventEmitter<void>;
    let visible: boolean;

    function initialiseTree(): vscode.Disposable {
        const host = { onDidChangeConfiguration: () => ({ dispose: () => undefined }) } as unknown as Host;
        return explorer.create({} as Kubectl, host).initialize();
    }

    setup(() => {
        sandbox = sinon.createSandbox();
        noteExplicitUse = sandbox.stub(clusterAccess, 'noteExplicitUse');
        visibility = new vscode.EventEmitter<vscode.TreeViewVisibilityChangeEvent>();
        expansion = new vscode.EventEmitter<vscode.TreeViewExpansionEvent<unknown>>();
        allow = new vscode.EventEmitter<void>();
        sandbox.replace(clusterAccess, 'onDidAllow', allow.event);
        visible = false;
        const noEvent = () => ({ dispose: () => undefined });
        sandbox.stub(vscode.window, 'createTreeView').callsFake(() => ({
            get visible() { return visible; },
            onDidChangeVisibility: visibility.event,
            onDidCollapseElement: noEvent,
            onDidExpandElement: expansion.event,
            dispose: () => undefined,
        }) as unknown as vscode.TreeView<unknown>);
    });
    teardown(() => {
        visibility.dispose();
        expansion.dispose();
        allow.dispose();
        sandbox.restore();
    });

    test('counts as explicit use when the view is opened', () => {
        const disposable = initialiseTree();
        sinon.assert.notCalled(noteExplicitUse);

        visibility.fire({ visible: true });

        sinon.assert.calledOnce(noteExplicitUse);
        disposable.dispose();
    });

    test('does not count a restored visible view until it is reopened', () => {
        visible = true;

        const disposable = initialiseTree();
        visibility.fire({ visible: true });
        sinon.assert.notCalled(noteExplicitUse);

        visibility.fire({ visible: false });
        visibility.fire({ visible: true });
        sinon.assert.calledOnce(noteExplicitUse);
        disposable.dispose();
    });

    test('does not count when the view is hidden', () => {
        const disposable = initialiseTree();

        visibility.fire({ visible: false });

        sinon.assert.notCalled(noteExplicitUse);
        disposable.dispose();
    });

    test('restores local contexts without requesting built-in or contributed resources until allowed', async () => {
        const allowed = sandbox.stub(clusterAccess, 'isAllowed').returns(false);
        const contexts = sandbox.stub(kubectlUtils, 'getContexts').resolves([
            { contextName: 'dev', clusterName: 'dev', userName: 'dev', active: true, provider: '' },
        ]);
        const host = { onDidChangeConfiguration: () => ({ dispose: () => undefined }) } as unknown as Host;
        const tree = explorer.create({} as Kubectl, host);
        const view = tree.initialize();
        const refresh = sandbox.spy();
        const listener = tree.onDidChangeTreeData(refresh);
        const folder = ResourceFolderNode.create(allKinds.pod);
        const read = sandbox.stub(folder, 'getChildren').resolves([]);
        const contributed = sandbox.stub().resolves([]);
        tree.registerExtender({ contributesChildren: (parent) => parent === folder, getChildren: contributed });

        assert.strictEqual((await tree.getChildren())?.[0].nodeType, 'context');
        assert.strictEqual((await tree.getChildren(folder))?.[0].nodeType, 'error');
        sinon.assert.calledOnce(contexts);
        sinon.assert.notCalled(read);
        sinon.assert.notCalled(contributed);

        allowed.returns(true);
        allow.fire();
        sinon.assert.calledOnce(refresh);
        await tree.getChildren(folder);
        sinon.assert.calledOnce(read);
        sinon.assert.calledOnce(contributed);
        listener.dispose();
        view.dispose();
    });

    test('defers a restored watch and rechecks access after the namespace lookup', async () => {
        const allowed = sandbox.stub(clusterAccess, 'isAllowed').returns(false);
        const namespace = sandbox.stub(kubectlUtils, 'currentNamespace').resolves('default');
        const folder = ResourceFolderNode.create(allKinds.pod);
        const uri = sandbox.stub(folder, 'apiURI').resolves('/api/v1/pods');
        sandbox.stub(config, 'getResourcesToBeWatched').returns([folder.kind.pluralDisplayName]);
        const startWatch = sandbox.stub(WatchManager.instance(), 'addWatch').resolves();
        const view = initialiseTree();
        expansion.fire({ element: folder });
        await settled();
        sinon.assert.notCalled(namespace);

        allowed.returns(true);
        allow.fire();
        await settled();
        sinon.assert.calledOnce(startWatch);

        namespace.callsFake(async () => {
            allowed.returns(false);
            return 'default';
        });
        allow.fire();
        await settled();
        sinon.assert.calledTwice(namespace);
        sinon.assert.calledOnce(uri);
        sinon.assert.calledOnce(startWatch);
        view.dispose();
    });

    for (const mode of ['manual', 'automatic']) {
        test(`replaces a ${mode} watch when the tree node changes`, async () => {
            sandbox.stub(clusterAccess, 'isAllowed').returns(true);
            sandbox.stub(kubectlUtils, 'currentNamespace').resolves('default');
            sandbox.stub(kubeconfig, 'loadKubeconfig').resolves();
            const first = ResourceFolderNode.create(allKinds.pod);
            const replacement = ResourceFolderNode.create(allKinds.pod);
            for (const node of [first, replacement]) {
                sandbox.stub(node, 'apiURI').resolves('/api/v1/pods');
            }
            sandbox.stub(config, 'getResourcesToBeWatched').returns([first.kind.pluralDisplayName]);
            const oldRequest = new AbortController();
            const newRequest = new AbortController();
            const watch = sandbox.stub(Watch.prototype, 'watch');
            watch.onFirstCall().resolves(oldRequest);
            watch.onSecondCall().resolves(newRequest);

            const host = { onDidChangeConfiguration: () => ({ dispose: () => undefined }) } as unknown as Host;
            const tree = explorer.create({} as Kubectl, host);
            const view = tree.initialize();
            const refresh = sandbox.stub(tree, 'queueRefresh');
            const start = async (node: ResourceFolderNode) => {
                if (mode === 'manual') {
                    await tree.watch(node);
                } else {
                    expansion.fire({ element: node });
                    await settled();
                }
            };

            try {
                await start(first);
                await start(replacement);
                sinon.assert.calledTwice(watch);
                assert.strictEqual(oldRequest.signal.aborted, true);
                watch.firstCall.args[2]('MODIFIED', {});
                watch.secondCall.args[2]('MODIFIED', {});
                sinon.assert.calledOnceWithExactly(refresh, replacement);
            } finally {
                tree.clearWatches();
                view.dispose();
            }
        });
    }
});

suite('On-demand cluster connection: YAML schema cache', () => {
    test('does not fetch while updates are blocked and serves the fallback', async () => {
        const fetch = sinon.stub().resolves('cluster schema');
        const cache = new BackgroundContextCache(fakeContextTracker('ctx'), fetch, 'fallback', () => () => false);

        assert.strictEqual(cache.active(), 'fallback');
        cache.invalidateActive();
        await settled();

        sinon.assert.notCalled(fetch);
        assert.strictEqual(cache.active(), 'fallback');
    });

    test('fetches the active context once updates are allowed and invalidated', async () => {
        let allowed = false;
        const fetch = sinon.stub().resolves('cluster schema');
        const cache = new BackgroundContextCache(fakeContextTracker('ctx'), fetch, 'fallback', () => () => allowed);

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

suite('On-demand cluster connection: switching modes during a schema fetch', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        const repoRoot = path.resolve(__dirname, '../../../../..');
        setAssetContext({ asAbsolutePath: (p: string) => path.join(repoRoot, p) } as unknown as vscode.ExtensionContext);
    });
    teardown(() => {
        setAssetContext(undefined as unknown as vscode.ExtensionContext);
        sandbox.restore();
    });

    test('skips the CRD queries when access is blocked while the swagger download runs', async () => {
        let allowed = true;
        sandbox.stub(swagger, 'getClusterSwagger').callsFake(async () => {
            allowed = false;
            return { succeeded: false, error: ['proxy aborted'] };
        });
        const crdCount = sandbox.stub(kubectlUtils, 'getCRDTypesNumber').resolves({ succeeded: true, result: 1 });
        const crdSchemas = sandbox.stub(swagger, 'getCrdSchemas').resolves({});

        await KubernetesClusterSchemaHolder.fromActiveCluster({} as Kubectl, () => allowed);

        sinon.assert.notCalled(crdCount);
        sinon.assert.notCalled(crdSchemas);
    });

    test('skips fetching CRD schemas when access is blocked while the CRD check runs', async () => {
        let allowed = true;
        sandbox.stub(swagger, 'getClusterSwagger').resolves({ succeeded: false, error: ['no cluster'] });
        sandbox.stub(config, 'getCRDCodeCompletionState').returns(undefined);
        sandbox.stub(kubectlUtils, 'getCRDTypesNumber').callsFake(async () => {
            allowed = false;
            return { succeeded: true, result: 1 };
        });
        const crdSchemas = sandbox.stub(swagger, 'getCrdSchemas').resolves({});

        await KubernetesClusterSchemaHolder.fromActiveCluster({} as Kubectl, () => allowed);

        sinon.assert.notCalled(crdSchemas);
    });

    test('still runs the CRD queries while access stays allowed, as before', async () => {
        sandbox.stub(swagger, 'getClusterSwagger').resolves({ succeeded: false, error: ['no cluster'] });
        sandbox.stub(config, 'getCRDCodeCompletionState').returns('enabled');
        const crdSchemas = sandbox.stub(swagger, 'getCrdSchemas').resolves({});

        const kubectl = {} as Kubectl;
        const isAllowed = () => true;
        await KubernetesClusterSchemaHolder.fromActiveCluster(kubectl, isAllowed);

        sinon.assert.calledOnceWithExactly(crdSchemas, kubectl, isAllowed);
    });

    test('does not cache a value fetched before access was blocked', async () => {
        let allowed = true;
        const fetch = sinon.stub().callsFake(async () => {
            allowed = false;
            return 'cluster schema';
        });
        const cache = new BackgroundContextCache(fakeContextTracker('ctx'), fetch, 'fallback', () => () => allowed);
        await settled();

        sinon.assert.calledOnce(fetch);
        assert.strictEqual(cache.active(), 'fallback');
    });

    test('restarts schema loading when access is restored and ignores the earlier result', async () => {
        let onDemand = false;
        const gate = new ClusterAccessGate(() => onDemand);
        const fetch = sinon.stub();
        let finishOld!: (value: string) => void;
        let finishNew!: (value: string) => void;
        fetch.onFirstCall().returns(new Promise<string>((resolve) => { finishOld = resolve; }));
        fetch.onSecondCall().returns(new Promise<string>((resolve) => { finishNew = resolve; }));
        const cache = new BackgroundContextCache(fakeContextTracker('ctx'), fetch, 'fallback', () => gate.captureAccess());
        const listener = gate.onDidAllow(() => cache.invalidateActive());

        onDemand = true;
        gate.onConfigurationChanged(configChange(config.CLUSTER_CONNECTION_SETTING));
        onDemand = false;
        gate.onConfigurationChanged(configChange(config.CLUSTER_CONNECTION_SETTING));
        sinon.assert.calledTwice(fetch);
        assert.strictEqual(fetch.firstCall.args[0](), false);
        finishOld('stale schema');
        await settled();
        assert.strictEqual(cache.active(), 'fallback');
        sinon.assert.calledTwice(fetch);

        finishNew('fresh schema');
        await settled();
        assert.strictEqual(cache.active(), 'fresh schema');
        listener.dispose();
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
    let kubectl: { invokeCommandArgs: sinon.SinonStub };
    let sendTelemetryEvent: sinon.SinonStub;
    let originalReporter: unknown;

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(clusterAccess, 'isAllowed').returns(false);
        kubectl = { invokeCommandArgs: sandbox.stub().resolves({ resultKind: 'exec-errored', stderr: '' }) };
        sendTelemetryEvent = sandbox.stub();
        originalReporter = telemetryExports.reporter;
        telemetryExports.reporter = { sendTelemetryEvent };
    });
    teardown(() => {
        telemetryExports.reporter = originalReporter;
        sandbox.restore();
    });

    test('does not probe the cluster when the context changes while access is blocked', async () => {
        invalidateClusterType(undefined, kubectl as unknown as Kubectl);
        await settled();

        sinon.assert.notCalled(kubectl.invokeCommandArgs);
    });

    test('does not probe the cluster if access is blocked after the probe was scheduled', async () => {
        (clusterAccess.isAllowed as sinon.SinonStub).returns(true);
        invalidateClusterType(undefined, kubectl as unknown as Kubectl);

        (clusterAccess.isAllowed as sinon.SinonStub).returns(false);
        await settled();

        sinon.assert.notCalled(kubectl.invokeCommandArgs);
    });

    test('does not start cluster-info if access is blocked during the local context lookup', async () => {
        const allowed = clusterAccess.isAllowed as sinon.SinonStub;
        allowed.returns(true);
        kubectl.invokeCommandArgs.withArgs(['config', 'current-context']).callsFake(async () => {
            allowed.returns(false);
            return { resultKind: 'exec-succeeded', stdout: 'dev' };
        });

        invalidateClusterType(undefined, kubectl as unknown as Kubectl);
        await settled();

        sinon.assert.calledOnceWithExactly(kubectl.invokeCommandArgs, ['config', 'current-context']);
    });

    test('reports commands without contacting the cluster while access is blocked', async () => {
        const callback = sandbox.stub().returns('result');

        const result = telemetrise('extension.vsKubernetesGet', kubectl as unknown as Kubectl, callback)('arg');
        await settled();

        assert.strictEqual(result, 'result');
        sinon.assert.calledOnceWithExactly(callback, 'arg');
        sinon.assert.notCalled(kubectl.invokeCommandArgs);
        sinon.assert.calledOnceWithExactly(sendTelemetryEvent, 'command', {
            command: 'extension.vsKubernetesGet', clusterType: 'indeterminate', nonDeterminationReason: ''
        });
    });
});

suite('On-demand cluster connection: inferred kubectl version', () => {
    let sandbox: sinon.SinonSandbox;
    let ensureSuitableKubectl: sinon.SinonStub;
    let configuredPath: sinon.SinonStub;
    let pathLookup: sinon.SinonStub;
    let cacheDir: string;
    let cachedBinary: string;
    let kubectl: Kubectl;

    async function executableUsed(): Promise<string> {
        const child = Object.assign(new NodeEventEmitter(), {
            pid: 123, stdout: new PassThrough(), stderr: new PassThrough(), kill: sinon.stub().returns(true), exitCode: null, signalCode: null,
        });
        const spawn = sandbox.stub(processes, 'spawnCommand').callsFake(() => {
            queueMicrotask(() => child.emit('spawn'));
            return child as unknown as ChildProcess;
        });
        await kubectl.spawnCommandArgs(['config', 'view']);
        return spawn.firstCall.args[0].executable;
    }

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(config, 'getUseWsl').returns(false);
        configuredPath = sandbox.stub(config, 'getToolPath').returns(undefined);
        ensureSuitableKubectl = sandbox.stub(autoversion, 'ensureSuitableKubectl').resolves('/inferred/kubectl');
        pathLookup = sandbox.stub(binutil, 'findBinaryPath').resolves(undefined);
        const shell = { ...shellModule.shell, isWindows: () => false, platform: () => shellModule.Platform.Linux, execOpts: () => ({}) };
        cacheDir = path.join(vsKubernetesFolder(shell), 'tools', 'kubectl', 'autoversion');
        cachedBinary = path.join(cacheDir, 'v1.32.0', formatBin('kubectl', shell.platform())!);
        kubectl = createKubectl(config.KubectlVersioning.Infer, {} as Host, fs, shell);
    });
    teardown(() => {
        kubectl.dispose();
        sandbox.restore();
    });

    test('uses the configured kubectl without checking the server version while access is blocked', async () => {
        sandbox.stub(clusterAccess, 'isAllowed').returns(false);
        configuredPath.returns('/configured/kubectl');
        sandbox.stub(fs, 'existsAsync').withArgs('/configured/kubectl').resolves(true);

        assert.strictEqual(await executableUsed(), '/configured/kubectl');
        sinon.assert.notCalled(ensureSuitableKubectl);
    });

    test('uses the cached kubectl when it is the only local binary, without checking the server version', async () => {
        sandbox.stub(clusterAccess, 'isAllowed').returns(false);
        const exists = sandbox.stub(fs, 'existsSync').callThrough();
        exists.withArgs(cacheDir).returns(true);
        exists.withArgs(cachedBinary).returns(true);
        sandbox.stub(fs, 'dirSync').withArgs(cacheDir).returns(['cache.json', 'v1.32.0']);

        assert.strictEqual(await executableUsed(), cachedBinary);
        sinon.assert.notCalled(ensureSuitableKubectl);
    });

    test('keeps PATH ahead of the autoversion cache', async () => {
        sandbox.stub(clusterAccess, 'isAllowed').returns(false);
        pathLookup.resolves('/path/kubectl');
        const readCache = sandbox.stub(fs, 'dirSync');

        assert.strictEqual(await executableUsed(), 'kubectl');
        sinon.assert.notCalled(readCache);
        sinon.assert.notCalled(ensureSuitableKubectl);
    });

    test('falls back to kubectl when the cache directory does not exist', async () => {
        sandbox.stub(clusterAccess, 'isAllowed').returns(false);
        sandbox.stub(fs, 'existsSync').callThrough().withArgs(cacheDir).returns(false);
        const readCache = sandbox.stub(fs, 'dirSync');

        assert.strictEqual(await executableUsed(), 'kubectl');
        sinon.assert.notCalled(readCache);
        sinon.assert.notCalled(ensureSuitableKubectl);
    });

    test('uses the inferred kubectl once access is allowed, as before', async () => {
        sandbox.stub(clusterAccess, 'isAllowed').returns(true);

        assert.strictEqual(await executableUsed(), '/inferred/kubectl');
        sinon.assert.calledOnce(ensureSuitableKubectl);
    });

    test('uses an available cached binary without inference for local reads in automatic mode', async () => {
        sandbox.stub(clusterAccess, 'isAllowed').returns(true);
        kubectl.dispose();
        const shell = { ...shellModule.shell, isWindows: () => false, platform: () => shellModule.Platform.Linux, execOpts: () => ({}) };
        kubectl = createLocal({} as Host, fs, shell);
        const exists = sandbox.stub(fs, 'existsSync').callThrough();
        exists.withArgs(cacheDir).returns(true);
        exists.withArgs(cachedBinary).returns(true);
        sandbox.stub(fs, 'dirSync').withArgs(cacheDir).returns(['v1.32.0']);

        assert.strictEqual(await executableUsed(), cachedBinary);
        sinon.assert.notCalled(ensureSuitableKubectl);
    });

    test('does not query the server if access is blocked while resolving the version cache', async () => {
        ensureSuitableKubectl.restore();
        const allowed = sandbox.stub(clusterAccess, 'isAllowed').returns(true);
        const readJSON = sandbox.stub();
        const bootstrapper = { ensurePresent: async () => true, readJSON } as unknown as Kubectl;
        sandbox.stub(fs, 'existsAsync').resolves(true);
        sandbox.stub(kubectlUtils, 'getCurrentContext').resolves({
            contextName: 'dev', clusterName: 'dev', userName: 'dev', active: true, provider: '',
        });
        sandbox.stub(FileBacked.prototype, 'update').resolves();
        sandbox.stub(FileBacked.prototype, 'get').callsFake(async () => {
            allowed.returns(false);
            return { derivedFromKubeconfig: undefined, versions: {} };
        });

        assert.strictEqual(await autoversion.ensureSuitableKubectl(bootstrapper, shellModule.shell, {} as Host, clusterAccess.captureAccess()), undefined);
        sinon.assert.notCalled(readJSON);
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
