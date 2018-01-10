import * as vscode from 'vscode';

import * as assert from 'assert';
import * as textassert from './textassert';
import * as fakes from './fakes';

import * as configureFromCluster from '../src/configurefromcluster';

const cancellationToken = new vscode.CancellationTokenSource().token;

interface FakeContext {
    fs? : any;
    shell? : any;
}

function cfcuiCreateWithFakes(ctx: FakeContext) {
    return configureFromCluster.uiProvider(
        ctx.fs || fakes.fs(),
        ctx.shell || fakes.shell()
    );
}

function lastResult(uiProvider: any, operationId: string) : any /* actually acs.StageData */ {
    // NOTE: this is tightly coupled to acs module internals
    const operations = uiProvider.operations;  // acs.OperationMap
    const operationState = operations.get(operationId);  // acs.OperationState
    return operationState.last;  // acs.StageData
}

suite("acs tests", () => {

    suite("uiProvider method", () => {

        test("Can create UI provider", () => {
            const cfcui = cfcuiCreateWithFakes({});
            assert.notEqual(cfcui, undefined);
            assert.notEqual(cfcui, null);
        });

    });

    suite("UIProvider class", () => {

        test("UI provider raises change event on start", () => {
            const cfcui = cfcuiCreateWithFakes({});
            let uris : vscode.Uri[] = [];
            cfcui.onDidChange((uri) => uris.push(uri));
            cfcui.start('foo');
            assert.equal(1, uris.length);
            assert.equal('k8sconfigure://operations/foo', uris[0].toString());
        });

        test("UI provider raises change event on next", async () => {
            const cfcui = cfcuiCreateWithFakes({});
            let uris : vscode.Uri[] = [];
            cfcui.start('bar');
            cfcui.onDidChange((uri) => uris.push(uri));
            await cfcui.next({ operationId: 'bar', requestData: null });
            assert.equal(1, uris.length);
            assert.equal('k8sconfigure://operations/bar', uris[0].toString());
        });

        test("Initiating an operation puts it at the initial stage", async () => {
            const cfcui = cfcuiCreateWithFakes({});
            cfcui.start('foo');
            const text = await cfcui.provideTextDocumentContent(configureFromCluster.operationUri('foo'), cancellationToken);
            textassert.startsWith('<!-- Initial -->', text);
        });

        test("Advancing an operation puts it through the stages", async () => {
            const cfcui = cfcuiCreateWithFakes({
                fs: fakes.fs({ existentPaths: ['z:\\home\\.ssh/id_rsa'] }),
                shell: fakes.shell({ isWindows: true, recognisedCommands: [
                    { command: 'az --version', code: 0, stdout: "azure-cli (2.0.23)" },
                ] })
            });
            cfcui.start('foo');
            await cfcui.next({ operationId: 'foo', requestData: null });
            const text0 = await cfcui.provideTextDocumentContent(configureFromCluster.operationUri('foo'), cancellationToken);
            textassert.startsWith('<!-- PromptForClusterType -->', text0);
            await cfcui.next({ operationId: 'foo', requestData: 'Azure Container Service' });
            const text1 = await cfcui.provideTextDocumentContent(configureFromCluster.operationUri('foo'), cancellationToken);
            textassert.startsWith('<!-- PromptForSubscription -->', text1);
            await cfcui.next({ operationId: 'foo', requestData: 'Sub1' });
            const text2 = await cfcui.provideTextDocumentContent(configureFromCluster.operationUri('foo'), cancellationToken);
            textassert.startsWith('<!-- PromptForCluster -->', text2);
            await cfcui.next({ operationId: 'foo', requestData: 'Group1/Clus1' });
            const text3 = await cfcui.provideTextDocumentContent(configureFromCluster.operationUri('foo'), cancellationToken);
            textassert.startsWith('<!-- Complete -->', text3);
        });

        test("Advancing an operation does not affect other operations", async () => {
            const cfcui = cfcuiCreateWithFakes({});
            cfcui.start('foo');
            cfcui.start('bar');
            await cfcui.next({ operationId: 'bar', requestData: null });
            await cfcui.next({ operationId: 'bar', requestData: 'Azure Container Service' });
            const text = await cfcui.provideTextDocumentContent(configureFromCluster.operationUri('foo'), cancellationToken);
            textassert.startsWith('<!-- Initial -->', text);
        });

    });

    suite("Operation workflow", () => {

        test("If the SSH keys are present and the CLI is installed, then it tries to list subscriptions", async () => {
            const cfcui = cfcuiCreateWithFakes({
                fs: fakes.fs({ existentPaths: ['z:\\home\\.ssh/id_rsa'] }),
                shell: fakes.shell({ isWindows: true, recognisedCommands: [
                    { command: 'az --version', code: 0, stdout: "azure-cli (2.0.23)" },
                    { command: 'az account list --all --query [*].name -ojson', code: 0, stdout: '["S1", "S2", "S3"]' },
                ] })
            });
            cfcui.start('foo');
            await cfcui.next({ operationId: 'foo', requestData: null });
            await cfcui.next({ operationId: 'foo', requestData: 'Azure Container Service' });
            const state = lastResult(cfcui, 'foo');
            assert.equal(state.result.succeeded, true);
            assert.equal(state.result.result.subscriptions.length, 3);
            assert.equal(state.result.result.subscriptions[0], 'S1');
        });

        test("If the SSH keys are not present, it is reported", async () => {
            const cfcui = cfcuiCreateWithFakes({
                fs: fakes.fs({ existentPaths: [] }),
                shell: fakes.shell({ isWindows: true, recognisedCommands: [{ command: 'az --help', code: 0 }] })
            });
            cfcui.start('foo');
            await cfcui.next({ operationId: 'foo', requestData: null });
            await cfcui.next({ operationId: 'foo', requestData: 'Azure Kubernetes Service' });
            const state = lastResult(cfcui, 'foo');
            assert.equal('checking prerequisites', state.actionDescription);
            assert.equal(state.result.succeeded, false);
            assert.equal(state.result.error.length, 1);
        });

        test("If the Azure CLI is not installed, it is reported", async () => {
            const cfcui = cfcuiCreateWithFakes({
                fs: fakes.fs({ existentPaths: ['z:\\home\\.ssh/id_rsa'] }),
                shell: fakes.shell({ isWindows: true })
            });
            cfcui.start('foo');
            await cfcui.next({ operationId: 'foo', requestData: null });
            await cfcui.next({ operationId: 'foo', requestData: 'Azure Kubernetes Service' });
            const state = lastResult(cfcui, 'foo');
            assert.equal('checking prerequisites', state.actionDescription);
            assert.equal(state.result.succeeded, false);
            assert.equal(state.result.error.length, 1);
        });

        test("If the SSH keys are not present *and* the CLI is not installed, both are reported", async () => {
            const cfcui = cfcuiCreateWithFakes({
                fs: fakes.fs({ existentPaths: [] }),
                shell: fakes.shell({ isWindows: true })
            });
            cfcui.start('foo');
            await cfcui.next({ operationId: 'foo', requestData: null });
            await cfcui.next({ operationId: 'foo', requestData: 'Azure Container Service' });
            const state = lastResult(cfcui, 'foo');
            assert.equal('checking prerequisites', state.actionDescription);
            assert.equal(state.result.succeeded, false);
            assert.equal(state.result.error.length, 2);
        });

        test("If the SSH keys are present and the CLI is installed, but listing subscriptions fails, the error is reported", async () => {
            const cfcui = cfcuiCreateWithFakes({
                fs: fakes.fs({ existentPaths: ['z:\\home\\.ssh/id_rsa'] }),
                shell: fakes.shell({ isWindows: true, recognisedCommands: [
                    { command: 'az --version', code: 0, stdout: "azure-cli (2.0.23)" },
                    { command: 'az account list --all --query [*].name -ojson', code: 2, stderr: 'network error' },
                ] })
            });
            cfcui.start('foo');
            await cfcui.next({ operationId: 'foo', requestData: null });
            await cfcui.next({ operationId: 'foo', requestData: 'Azure Container Service' });
            const state = lastResult(cfcui, 'foo');
            assert.equal('listing subscriptions', state.actionDescription);
            assert.equal(state.result.succeeded, false);
            assert.equal(state.result.error.length, 1);
            assert.equal(state.result.error[0], 'network error');
        });

        test("After listing subscriptions, it selects the subscription returned in the next request", async () => {
            let commands = [];
            const cfcui = cfcuiCreateWithFakes({
                fs: fakes.fs({ existentPaths: ['z:\\home\\.ssh/id_rsa'] }),
                shell: fakes.shell({
                    isWindows: true,
                    recognisedCommands: [
                        { command: 'az --version', code: 0, stdout: "azure-cli (2.0.23)" },
                        { command: 'az account list --all --query [*].name -ojson', code: 0, stdout: '["S1", "S2", "S3"]' }
                    ],
                    execCallback: (cmd) => { commands.push(cmd); return { code: 1 /* stop it before it goes on to exec other commands */, stdout: '[]', stderr: ''}; }
                })
            });
            cfcui.start('foo');
            await cfcui.next({ operationId: 'foo', requestData: null });
            await cfcui.next({ operationId: 'foo', requestData: 'Azure Kubernetes Service' });
            await cfcui.next({ operationId: 'foo', requestData: 'S2' });
            assert.equal(commands.length, 1);
            assert.equal(commands[0], 'az account set --subscription "S2"');
        });
    });

});