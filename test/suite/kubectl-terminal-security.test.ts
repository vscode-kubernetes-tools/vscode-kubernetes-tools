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

    test('uses executable and shellArgs without mutating hostile arguments', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const args = ['exec', 'api-0', '--', '/bin/sh', '-c', 'echo "$HOME"; id & whoami'];
        const original = [...args];
        const show = sinon.spy();
        const createTerminal = sinon.stub().returns({ show });
        const kubectl = createOnBinary(
            fakeHost(createTerminal),
            fakeFs(),
            fakeShell(false),
            '/opt/Kube Tools/kubectl'
        );

        await kubectl.runAsTerminal(args, 'kubectl test');

        assert.deepStrictEqual(args, original);
        sinon.assert.calledOnceWithExactly(
            createTerminal,
            'kubectl test',
            '/opt/Kube Tools/kubectl',
            original,
            undefined
        );
        sinon.assert.calledOnce(show);
    });

    test('adds the Windows executable suffix without quoting the path', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const createTerminal = sinon.stub().returns({ show: sinon.spy() });
        const kubectl = createOnBinary(
            fakeHost(createTerminal),
            fakeFs(),
            fakeShell(true),
            'C:\\Program Files\\Kubernetes\\kubectl'
        );

        await kubectl.runAsTerminal(['get', 'pods', '--context', '%PATH% & marker'], 'kubectl test');

        sinon.assert.calledOnceWithExactly(
            createTerminal,
            'kubectl test',
            'C:\\Program Files\\Kubernetes\\kubectl.exe',
            ['get', 'pods', '--context', '%PATH% & marker'],
            undefined
        );
    });

    test('uses wsl.exe --exec and keeps values as arguments', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const createTerminal = sinon.stub().returns({ show: sinon.spy() });
        const kubectl = createOnBinary(
            fakeHost(createTerminal),
            fakeFs(),
            fakeShell(false),
            '/usr/local/bin/kubectl'
        );

        await kubectl.runAsTerminal(['get', 'pods', '--selector', 'app=$(marker)'], 'kubectl WSL');

        sinon.assert.calledOnceWithExactly(
            createTerminal,
            'kubectl WSL',
            'wsl.exe',
            ['--exec', '/usr/local/bin/kubectl', 'get', 'pods', '--selector', 'app=$(marker)'],
            undefined
        );
    });
});

function fakeHost(createTerminal: sinon.SinonStub): Host {
    return {
        createTerminal,
        onDidCloseTerminal: () => ({ dispose: () => {} }),
        onDidChangeConfiguration: () => ({ dispose: () => {} }),
        showErrorMessage: async () => undefined,
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

function fakeShell(windows: boolean): Shell {
    return {
        isWindows: () => windows,
        isUnix: () => !windows,
        platform: () => windows ? Platform.Windows : Platform.Linux,
        home: () => '',
        combinePath: () => '',
        fileUri: () => { throw new Error('unused'); },
        execOpts: () => ({ cwd: '/workspace', env: {} }),
        unquotedPath: (value) => value,
        which: () => null,
        cat: () => '',
        ls: () => [],
    };
}
