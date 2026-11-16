import * as assert from 'assert';
import nativeFs = require('fs');
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ExecResult } from '../../src/binutilplusplus';
import { diffKubernetesCore, DiffResult, DiffResultKind } from '../../src/extension';
import { Kubectl } from '../../src/kubectl';

const binary = { binBaseName: 'kubectl', configKeyName: 'kubectl', displayName: 'Kubectl', offersInstall: true };

suite('Diff and Apply preflight security', () => {
    let sandbox: sinon.SinonSandbox;
    let editor: vscode.TextEditor;
    let response: ExecResult;
    let invoke: sinon.SinonStub;
    let legacy: sinon.SinonStub;
    let showDiff: sinon.SinonStub;
    let writeFile: sinon.SinonStub;
    let kubectl: Kubectl;

    setup(() => {
        sandbox = sinon.createSandbox();
        response = { resultKind: 'exec-succeeded', execProgram: binary, command: 'display only', stdout: 'server content' };
        invoke = sandbox.stub().callsFake(async () => response);
        legacy = sandbox.stub().callsFake(async (_command: string, callback: (result: ExecResult) => void) => callback(response));
        kubectl = { invokeCommandArgs: invoke, invokeCommandThen: legacy } as unknown as Kubectl;
        sandbox.stub(vscode.window, 'activeTextEditor').get(() => editor);
        sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
        sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);
        sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
        showDiff = sandbox.stub(vscode.commands, 'executeCommand').resolves(undefined);
        writeFile = sandbox.stub(nativeFs, 'writeFile').yields(null);
    });
    teardown(() => sandbox.restore());

    function document(text: string, isUntitled: boolean, languageId = 'yaml') {
        editor = {
            document: {
                isUntitled, isDirty: false, languageId,
                uri: vscode.Uri.file('/fixture/resource.json'),
                getText: () => text,
            },
        } as vscode.TextEditor;
    }

    function run(): Promise<DiffResult> {
        return new Promise((resolve) => diffKubernetesCore(resolve, kubectl));
    }

    test('keeps an untitled manifest identity literal and looks up its own namespace', async () => {
        const name = 'reader $(printf marker); "quoted"';
        const text = `apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: '${name}'\n  namespace: prod\nrules: []\n`;
        document(text, true);

        assert.strictEqual((await run()).result, DiffResultKind.Succeeded);

        sinon.assert.calledOnceWithExactly(invoke, ['get', '-o', 'yaml', `role/${name}`, '--namespace', 'prod']);
        sinon.assert.notCalled(legacy);
        assert.strictEqual(writeFile.firstCall.args[1], text);
        assert.strictEqual(writeFile.secondCall.args[1], 'server content');
        assert.strictEqual(showDiff.firstCall.args[0], 'vscode.diff');
        sinon.assert.notCalled(vscode.window.showInformationMessage as sinon.SinonStub);
    });

    test('retains the default namespace lookup and JSON output for a saved document', async () => {
        document(JSON.stringify({ apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'app-config' } }), false, 'json');

        assert.strictEqual((await run()).result, DiffResultKind.Succeeded);

        sinon.assert.calledOnceWithExactly(invoke, ['get', '-o', 'json', 'configmap/app-config']);
        sinon.assert.notCalled(legacy);
        sinon.assert.calledOnce(writeFile);
        assert.strictEqual(showDiff.firstCall.args[2].fsPath, editor.document.uri.fsPath);
    });

    test('rejects invalid manifest kinds, names and namespaces before the lookup', async () => {
        for (const resource of [
            { kind: '--invalid', metadata: { name: 'web' } },
            { kind: 'Deployment', metadata: { name: 'bad/name' } },
            { kind: 'Deployment', metadata: { name: 'web', namespace: 'bad;namespace' } },
        ]) {
            document(JSON.stringify({ apiVersion: 'apps/v1', ...resource }), true);

            assert.strictEqual((await run()).result, DiffResultKind.NoKindName);
        }

        sinon.assert.notCalled(invoke);
        sinon.assert.notCalled(legacy);
        sinon.assert.notCalled(showDiff);
    });

    test('keeps NotFound distinct from other lookup errors without opening a diff', async () => {
        document('kind: ConfigMap\nmetadata:\n  name: app-config\n', true);
        response = { resultKind: 'exec-errored', execProgram: binary, command: 'display only', code: 1, stderr: 'NotFound' };

        assert.deepStrictEqual(await run(), { result: DiffResultKind.NoClusterResource, resourceName: 'configmap/app-config' });

        response = { ...response, code: 7, stderr: 'Forbidden' };
        const failure = await run();
        assert.strictEqual(failure.result, DiffResultKind.GetFailed);
        assert.ok(failure.stderr?.includes('Forbidden'));
        sinon.assert.notCalled(showDiff);
    });

    test('keeps multi-resource documents out of the single-resource preflight', async () => {
        document('kind: Pod\nmetadata:\n  name: first\n---\nkind: Pod\nmetadata:\n  name: second\n', true);

        assert.strictEqual((await run()).result, DiffResultKind.NoKindName);

        sinon.assert.notCalled(invoke);
        sinon.assert.notCalled(legacy);
        sinon.assert.notCalled(showDiff);
    });
});
