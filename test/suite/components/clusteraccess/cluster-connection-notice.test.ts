import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
    NOTICE_CHECKED_KEY, OPEN_SETTING_ACTION, SWITCH_ACTION, showClusterConnectionNotice
} from '../../../../src/components/clusteraccess/cluster-connection-notice';
import * as config from '../../../../src/components/config/config';
import { Kubectl } from '../../../../src/kubectl';

function kubeconfigWithUser(user: object): string {
    return JSON.stringify({
        'current-context': 'dev',
        contexts: [{ name: 'dev', context: { cluster: 'dev-cluster', user: 'dev-user' } }],
        users: [{ name: 'dev-user', user }],
    });
}

const EXEC_USER = { exec: { command: 'kubelogin', args: ['get-token'] } };
const TOKEN_USER = { token: 'REDACTED' };

suite('On-demand cluster connection: one-time notice', () => {
    let sandbox: sinon.SinonSandbox;
    let state: Map<string, unknown>;
    let context: vscode.ExtensionContext;
    let kubectl: { invokeCommandArgs: sinon.SinonStub };
    let info: sinon.SinonStub;
    let setOnDemand: sinon.SinonStub;
    let executeCommand: sinon.SinonStub;

    function readsKubeconfig(stdout: string): void {
        kubectl.invokeCommandArgs.resolves({ resultKind: 'exec-succeeded', stdout, stderr: '', command: 'kubectl config view' });
    }

    async function run(): Promise<void> {
        await showClusterConnectionNotice(context, kubectl as unknown as Kubectl);
    }

    setup(() => {
        sandbox = sinon.createSandbox();
        state = new Map();
        context = {
            globalState: {
                get: (key: string) => state.get(key),
                update: async (key: string, value: unknown) => { state.set(key, value); },
                setKeysForSync: sandbox.stub(),
            },
        } as unknown as vscode.ExtensionContext;
        kubectl = { invokeCommandArgs: sandbox.stub() };
        info = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
        setOnDemand = sandbox.stub(config, 'setOnDemandClusterConnection').resolves();
        executeCommand = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        sandbox.stub(config, 'isClusterConnectionConfigured').returns(false);
    });
    teardown(() => sandbox.restore());

    test('shows once when the current context signs in with a credential plugin', async () => {
        readsKubeconfig(kubeconfigWithUser(EXEC_USER));

        await run();
        await run();

        sinon.assert.calledOnceWithExactly(kubectl.invokeCommandArgs, ['config', 'view', '-o', 'json']);
        sinon.assert.calledOnceWithExactly(info, sinon.match.string, SWITCH_ACTION, OPEN_SETTING_ACTION);
        sinon.assert.calledWithExactly(context.globalState.setKeysForSync as sinon.SinonStub, [NOTICE_CHECKED_KEY]);
    });

    test('switches to on-demand when chosen', async () => {
        readsKubeconfig(kubeconfigWithUser(EXEC_USER));
        info.resolves(SWITCH_ACTION);

        await run();

        sinon.assert.calledOnce(setOnDemand);
        sinon.assert.notCalled(executeCommand);
    });

    test('opens the setting when chosen', async () => {
        readsKubeconfig(kubeconfigWithUser(EXEC_USER));
        info.resolves(OPEN_SETTING_ACTION);

        await run();

        sinon.assert.calledOnceWithExactly(executeCommand, 'workbench.action.openSettings', config.CLUSTER_CONNECTION_SETTING);
        sinon.assert.notCalled(setOnDemand);
    });

    test('stays silent for contexts without a credential plugin and does not check again', async () => {
        readsKubeconfig(kubeconfigWithUser(TOKEN_USER));

        await run();
        await run();

        sinon.assert.calledOnce(kubectl.invokeCommandArgs);
        sinon.assert.notCalled(info);
    });

    test('does nothing when the user has already chosen a cluster connection mode', async () => {
        (config.isClusterConnectionConfigured as sinon.SinonStub).returns(true);

        await run();

        sinon.assert.notCalled(kubectl.invokeCommandArgs);
        sinon.assert.notCalled(info);
    });

    test('checks again next time if the kubeconfig cannot be read', async () => {
        kubectl.invokeCommandArgs.resolves({ resultKind: 'exec-errored', code: 1, stdout: '', stderr: 'no kubeconfig', command: 'kubectl config view' });

        await run();
        readsKubeconfig(kubeconfigWithUser(EXEC_USER));
        await run();

        sinon.assert.calledTwice(kubectl.invokeCommandArgs);
        sinon.assert.calledOnce(info);
    });
});
