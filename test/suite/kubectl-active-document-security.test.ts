import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ExecResult } from '../../src/binutilplusplus';
import { kubectlTextDocument, runKubectlViaTempFile, TextDocumentCommandDependencies } from '../../src/extension';

suite('Kubectl active document security', () => {
    test('reports WSL conversion failure without invoking kubectl', async () => {
        const convertPath = sinon.stub().rejects(new Error('Unable to convert the Windows path for WSL.'));
        const invoke = sinon.stub();
        const showError = sinon.stub().resolves(undefined);
        const handler = sinon.stub();
        const document = {
            uri: vscode.Uri.file('C:\\work dir\\manifest.yaml'),
            fileName: 'C:\\work dir\\manifest.yaml',
            getText: () => '',
        } as vscode.TextDocument;
        const dependencies: TextDocumentCommandDependencies = {
            useWsl: () => true,
            convertPath,
            invoke,
            showError,
        };

        await kubectlTextDocument('apply', document, 'team-a', 'Applying...', handler, dependencies);

        sinon.assert.calledOnceWithExactly(convertPath, 'C:\\work dir\\manifest.yaml');
        sinon.assert.notCalled(invoke);
        sinon.assert.notCalled(handler);
        sinon.assert.calledOnceWithExactly(
            showError,
            'Unable to run kubectl for the active document: Unable to convert the Windows path for WSL.'
        );
    });

    test('awaits asynchronous result reporting', async () => {
        const result = { resultKind: 'exec-succeeded', stdout: 'applied' } as ExecResult;
        const invoke = sinon.stub().resolves(result);
        let reported = false;
        const handler = async () => {
            await Promise.resolve();
            reported = true;
        };
        const document = {
            uri: vscode.Uri.file('/tmp/manifest.yaml'),
            fileName: '/tmp/manifest.yaml',
            getText: () => '',
        } as vscode.TextDocument;

        await kubectlTextDocument('apply', document, undefined, 'Applying...', handler, {
            useWsl: () => false,
            convertPath: async (value) => value,
            invoke,
            showError: sinon.stub().resolves(undefined),
        });

        assert.strictEqual(reported, true);
    });

    test('removes temporary content before awaiting result reporting', async () => {
        const events: string[] = [];
        const result = { resultKind: 'exec-succeeded', stdout: 'applied' } as ExecResult;

        await runKubectlViaTempFile('apply', 'kind: Pod', undefined, 'Applying...', async () => {
            events.push('report');
        }, {
            createTempFile: () => ({ name: '/tmp/manifest.yaml', removeCallback: () => events.push('remove') }),
            writeFile: () => events.push('write'),
            useWsl: () => false,
            convertPath: async (value) => value,
            invoke: async () => {
                events.push('invoke');
                return result;
            },
            showError: sinon.stub().resolves(undefined),
        });

        assert.deepStrictEqual(events, ['write', 'invoke', 'remove', 'report']);
    });

    test('removes temporary content before reporting conversion failure', async () => {
        const events: string[] = [];

        await runKubectlViaTempFile('apply', 'kind: Secret', undefined, 'Applying...', sinon.stub(), {
            createTempFile: () => ({ name: 'C:\\temp\\manifest.yaml', removeCallback: () => events.push('remove') }),
            writeFile: () => events.push('write'),
            useWsl: () => true,
            convertPath: async () => {
                events.push('convert');
                throw new Error('wslpath failed');
            },
            invoke: sinon.stub(),
            showError: async () => {
                events.push('error');
                return undefined;
            },
        });

        assert.deepStrictEqual(events, ['write', 'convert', 'remove', 'error']);
    });
});
