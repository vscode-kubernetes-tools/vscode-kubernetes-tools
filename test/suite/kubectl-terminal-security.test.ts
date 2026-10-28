import * as assert from 'assert';
import * as sinon from 'sinon';
import * as config from '../../src/components/config/config';
import { FS } from '../../src/fs';
import { Host } from '../../src/host';
import { createOnBinary } from '../../src/kubectl';
import { Platform, Shell } from '../../src/shell';

suite('Kubectl terminal security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => sandbox.restore());

    test('uses the selected executable and shellArgs without mutation', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const args = ['exec', 'api-0', '--', '/bin/sh', '-c', 'echo "$HOME"; marker'];
        const original = [...args];
        const show = sinon.spy();
        const createTerminal = sinon.stub().returns({ show });
        const kubectl = createOnBinary(fakeHost(createTerminal), fakeFs(), fakeShell(false), '/opt/Kube Tools/kubectl');

        await kubectl.invokeArgsInNewTerminal(args, 'kubectl');

        assert.deepStrictEqual(args, original);
        sinon.assert.calledOnceWithExactly(
            createTerminal,
            'kubectl',
            '/opt/Kube Tools/kubectl',
            original,
            undefined
        );
        sinon.assert.calledOnce(show);
    });

    test('uses wsl.exe --exec for WSL', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const createTerminal = sinon.stub().returns({ show: sinon.spy() });
        const kubectl = createOnBinary(fakeHost(createTerminal), fakeFs(), fakeShell(false, { SystemRoot: 'C:\\Windows' }), '/usr/local/bin/kubectl');

        await kubectl.invokeArgsInNewTerminal(['get', 'pods', '--selector', 'app=$(marker)'], 'kubectl');

        sinon.assert.calledOnceWithExactly(
            createTerminal,
            'kubectl',
            'C:\\Windows\\System32\\wsl.exe',
            ['--exec', '/usr/local/bin/kubectl', 'get', 'pods', '--selector', 'app=$(marker)'],
            undefined
        );
    });

    test('preserves an uppercase Windows executable suffix', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const createTerminal = sinon.stub().returns({ show: sinon.spy() });
        const kubectl = createOnBinary(fakeHost(createTerminal), fakeFs(), fakeShell(true), 'C:\\Tools\\KUBECTL.EXE');

        await kubectl.invokeArgsInNewTerminal(['port-forward', 'pods/api-0', '8080:8080'], 'kubectl');

        assert.strictEqual(createTerminal.firstCall.args[1], 'C:\\Tools\\KUBECTL.EXE');
    });

    test('reports configured Windows command scripts without launching a terminal', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const createTerminal = sinon.stub();
        const showErrorMessage = sinon.stub().resolves(undefined);
        const kubectl = createOnBinary(
            fakeHost(createTerminal, showErrorMessage),
            fakeFs(),
            fakeShell(true),
            'C:\\Tools\\kubectl.cmd'
        );

        await kubectl.invokeArgsInNewTerminal(['get', 'pods'], 'kubectl');

        sinon.assert.notCalled(createTerminal);
        sinon.assert.calledOnceWithExactly(
            showErrorMessage,
            "Cannot launch configured kubectl command script 'C:\\Tools\\kubectl.cmd' without a shell. Configure a kubectl.exe path instead."
        );
    });

    test('preserves the command-script reason for argv execution failures', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const kubectl = createOnBinary(
            fakeHost(sinon.stub()),
            fakeFs(),
            fakeShell(true),
            'C:\\Tools\\kubectl.cmd'
        );

        const result = await kubectl.invokeCommandArgs(['get', 'pods']);

        assert.strictEqual(result.resultKind, 'exec-failed');
        if (result.resultKind === 'exec-failed') {
            assert.strictEqual(
                result.error,
                "Configured Kubectl path 'C:\\Tools\\kubectl.cmd' is a command script; configure an .exe path for shell-free execution."
            );
        }
    });
});

function fakeHost(createTerminal: sinon.SinonStub, showErrorMessage: sinon.SinonStub = sinon.stub().resolves(undefined)): Host {
    return {
        createTerminal,
        onDidCloseTerminal: () => ({ dispose: () => {} }),
        onDidChangeConfiguration: () => ({ dispose: () => {} }),
        showErrorMessage,
        showWarningMessage: async () => undefined,
        showInformationMessage: async () => undefined,
        showInputBox: async () => undefined,
        showQuickPick: async () => undefined,
        withProgress: async (task: any) => task({ report: () => {} }),
        getConfiguration: () => undefined,
        activeDocument: () => undefined,
        showDocument: async () => { throw new Error('unused'); },
        readDocument: async () => { throw new Error('unused'); },
        selectRootFolder: async () => undefined,
        longRunning: async (_options: any, action: any) => action(),
    } as Host;
}

function fakeFs(): FS {
    return { existsAsync: async () => true } as unknown as FS;
}

function fakeShell(windows: boolean, env: NodeJS.ProcessEnv = {}): Shell {
    return {
        isWindows: () => windows,
        isUnix: () => !windows,
        platform: () => windows ? Platform.Windows : Platform.Linux,
        home: () => '',
        combinePath: () => '',
        fileUri: () => { throw new Error('unused'); },
        execOpts: () => ({ cwd: '/workspace', env }),
        exec: async () => undefined,
        execStreaming: async () => undefined,
        execCore: async () => ({ code: 0, stdout: '', stderr: '' }),
        unquotedPath: (value) => value,
        which: () => null,
        cat: () => '',
        ls: () => [],
    };
}
