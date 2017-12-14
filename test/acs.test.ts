import * as vscode from 'vscode';

import * as assert from 'assert';
import * as textassert from './textassert';
import * as fakes from './fakes';

import * as acs from '../src/acs';

const cancellationToken = new vscode.CancellationTokenSource().token;

interface FakeContext {
    fs? : any;
    shell? : any;
}

function acsuiCreateWithFakes(ctx: FakeContext) {
    return acs.uiProvider(
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
            const acsui = acsuiCreateWithFakes({});
            assert.notEqual(acsui, undefined);
            assert.notEqual(acsui, null);
        });

    });

    suite("UIProvider class", () => {

        test("UI provider raises change event on start", () => {
            const acsui = acsuiCreateWithFakes({});
            let uris : vscode.Uri[] = [];
            acsui.onDidChange((uri) => uris.push(uri));
            acsui.start('foo');
            assert.equal(1, uris.length);
            assert.equal('acsconfigure://operations/foo', uris[0].toString());
        });

        test("UI provider raises change event on next", async () => {
            const acsui = acsuiCreateWithFakes({});
            let uris : vscode.Uri[] = [];
            acsui.start('bar');
            acsui.onDidChange((uri) => uris.push(uri));
            await acsui.next({ operationId: 'bar', requestData: null });
            assert.equal(1, uris.length);
            assert.equal('acsconfigure://operations/bar', uris[0].toString());
        });

        test("Initiating an operation puts it at the initial stage", async () => {
            const acsui = acsuiCreateWithFakes({});
            acsui.start('foo');
            const text = await acsui.provideTextDocumentContent(acs.operationUri('foo'), cancellationToken);
            textassert.startsWith('<!-- Initial -->', text);
        });

        test("Advancing an operation puts it through the stages", async () => {
            const acsui = acsuiCreateWithFakes({});
            acsui.start('foo');
            await acsui.next({ operationId: 'foo', requestData: null });
            const text1 = await acsui.provideTextDocumentContent(acs.operationUri('foo'), cancellationToken);
            textassert.startsWith('<!-- PromptForSubscription -->', text1);
            await acsui.next({ operationId: 'foo', requestData: null });
            const text2 = await acsui.provideTextDocumentContent(acs.operationUri('foo'), cancellationToken);
            textassert.startsWith('<!-- PromptForCluster -->', text2);
            await acsui.next({ operationId: 'foo', requestData: null });
            const text3 = await acsui.provideTextDocumentContent(acs.operationUri('foo'), cancellationToken);
            textassert.startsWith('<!-- Complete -->', text3);
        });

        test("Advancing an operation does not affect other operations", async () => {
            const acsui = acsuiCreateWithFakes({});
            acsui.start('foo');
            acsui.start('bar');
            await acsui.next({ operationId: 'bar', requestData: null });
            await acsui.next({ operationId: 'bar', requestData: null });
            const text = await acsui.provideTextDocumentContent(acs.operationUri('foo'), cancellationToken);
            textassert.startsWith('<!-- Initial -->', text);
        });

    });

    suite("Operation workflow", () => {

        test("If the SSH keys are present and the CLI is installed, then it tries to list subscriptions", async () => {
            const acsui = acsuiCreateWithFakes({
                fs: fakes.fs({ existentPaths: ['z:\\home\\.ssh/id_rsa'] }),
                shell: fakes.shell({ isWindows: true, recognisedCommands: [
                    { command: 'az --help', code: 0 },
                    { command: 'az account list --all --query [*].name -ojson', code: 0, stdout: '["S1", "S2", "S3"]' },
                ] })
            });
            acsui.start('foo');
            await acsui.next({ operationId: 'foo', requestData: null });
            const state = lastResult(acsui, 'foo');
            assert.equal(state.result.succeeded, true);
            assert.equal(state.result.result.length, 3);
            assert.equal(state.result.result[0], 'S1');
        });

        test("If the SSH keys are not present, it is reported", async () => {
            const acsui = acsuiCreateWithFakes({
                fs: fakes.fs({ existentPaths: [] }),
                shell: fakes.shell({ isWindows: true, recognisedCommands: [{ command: 'az --help', code: 0 }] })
            });
            acsui.start('foo');
            await acsui.next({ operationId: 'foo', requestData: null });
            const state = lastResult(acsui, 'foo');
            assert.equal('checking prerequisites', state.actionDescription);
            assert.equal(state.result.succeeded, false);
            assert.equal(state.result.error.length, 1);
        });

        test("If the Azure CLI is not installed, it is reported", async () => {
            const acsui = acsuiCreateWithFakes({
                fs: fakes.fs({ existentPaths: ['z:\\home\\.ssh/id_rsa'] }),
                shell: fakes.shell({ isWindows: true })
            });
            acsui.start('foo');
            await acsui.next({ operationId: 'foo', requestData: null });
            const state = lastResult(acsui, 'foo');
            assert.equal('checking prerequisites', state.actionDescription);
            assert.equal(state.result.succeeded, false);
            assert.equal(state.result.error.length, 1);
        });

        test("If the SSH keys are not present *and* the CLI is not installed, both are reported", async () => {
            const acsui = acsuiCreateWithFakes({
                fs: fakes.fs({ existentPaths: [] }),
                shell: fakes.shell({ isWindows: true })
            });
            acsui.start('foo');
            await acsui.next({ operationId: 'foo', requestData: null });
            const state = lastResult(acsui, 'foo');
            assert.equal('checking prerequisites', state.actionDescription);
            assert.equal(state.result.succeeded, false);
            assert.equal(state.result.error.length, 2);
        });

        test("If the SSH keys are present and the CLI is installed, but listing subscriptions fails, the error is reported", async () => {
            const acsui = acsuiCreateWithFakes({
                fs: fakes.fs({ existentPaths: ['z:\\home\\.ssh/id_rsa'] }),
                shell: fakes.shell({ isWindows: true, recognisedCommands: [
                    { command: 'az --help', code: 0 },
                    { command: 'az account list --all --query [*].name -ojson', code: 2, stderr: 'network error' },
                ] })
            });
            acsui.start('foo');
            await acsui.next({ operationId: 'foo', requestData: null });
            const state = lastResult(acsui, 'foo');
            assert.equal('listing subscriptions', state.actionDescription);
            assert.equal(state.result.succeeded, false);
            assert.equal(state.result.error.length, 1);
            assert.equal(state.result.error[0], 'network error');
        });

        test("After listing subscriptions, it selects the subscription returned in the next request", async () => {
            let commands = [];
            const acsui = acsuiCreateWithFakes({
                fs: fakes.fs({ existentPaths: ['z:\\home\\.ssh/id_rsa'] }),
                shell: fakes.shell({
                    isWindows: true,
                    recognisedCommands: [
                        { command: 'az --help', code: 0 },
                        { command: 'az account list --all --query [*].name -ojson', code: 0, stdout: '["S1", "S2", "S3"]' }
                    ],
                    execCallback: (cmd) => { commands.push(cmd); return { code: 1 /* stop it before it goes on to exec other commands */, stdout: '[]', stderr: ''}; }
                })
            });
            acsui.start('foo');
            await acsui.next({ operationId: 'foo', requestData: null });
            await acsui.next({ operationId: 'foo', requestData: 'S2' });
            assert.equal(commands.length, 1);
            assert.equal(commands[0], 'az account set --subscription "S2"');
        });
    });

});