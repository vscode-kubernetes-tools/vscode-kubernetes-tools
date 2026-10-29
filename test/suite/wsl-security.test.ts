import * as assert from 'assert';
import * as sinon from 'sinon';
import childProcesses = require('child_process');
import nativeFs = require('fs');
import * as path from 'path';
import * as os from 'os';
import type { SpawnSyncReturns } from 'child_process';
import type { KubeConfig } from '@kubernetes/client-node';
import * as config from '../../src/components/config/config';
import * as wsl from '../../src/wsl';
import * as wslFs from '../../src/wsl-fs';
import { shell } from '../../src/shell';
import { getKubeconfigPath, getKubeconfigFiles, loadKubeconfig } from '../../src/components/kubectl/kubeconfig';

suite('WSL argument security', () => {
    let sandbox: sinon.SinonSandbox;
    setup(() => { sandbox = sinon.createSandbox(); sandbox.stub(config, 'getUseWsl').returns(true); });
    teardown(() => sandbox.restore());

    test('starts WSL with literal arguments and no host shell', () => {
        const previousSystemRoot = process.env.SystemRoot;
        process.env.SystemRoot = 'C:\\Windows';
        const spawn = sandbox.stub(childProcesses, 'spawnSync').returns({
            status: 0, stdout: 'out', stderr: 'warning', signal: null,
        } as SpawnSyncReturns<string>);
        const args = ['cat', '--', '/tmp/a & b;$(marker) %PATH% !x! "quoted"'];
        try {
            assert.deepStrictEqual(wsl.execWslSync(args), { code: 0, stdout: 'out', stderr: 'warning' });
            sinon.assert.calledOnceWithExactly(spawn, 'C:\\Windows\\System32\\wsl.exe', ['--exec', ...args], {
                encoding: 'utf8', shell: false, windowsHide: true, maxBuffer: 20 * 1024 * 1024,
            });
            assert.strictEqual(args[0], 'cat');
        } finally {
            restoreEnvironmentVariable('SystemRoot', previousSystemRoot);
        }
    });

    test('reports missing WSL, output-limit errors, and signal termination', () => {
        const previousSystemRoot = process.env.SystemRoot;
        process.env.SystemRoot = 'C:\\Windows';
        const spawn = sandbox.stub(childProcesses, 'spawnSync');
        try {
            for (const code of ['ENOENT', 'ENOBUFS']) {
                spawn.returns({ error: Object.assign(new Error(code), { code }), status: null, signal: null, pid: 0, output: [], stdout: '', stderr: '' });
                assert.throws(() => wsl.execWslSync(['cat', '--', '/path']), new RegExp(code));
            }
            spawn.returns({ status: null, stdout: '', stderr: '', signal: 'SIGTERM' } as SpawnSyncReturns<string>);
            assert.strictEqual(wsl.execWslSync(['cat', '--', '/path']).code, -1);
        } finally {
            restoreEnvironmentVariable('SystemRoot', previousSystemRoot);
        }
    });

    test('uses stat instead of an interpolated ls/grep pipeline', () => {
        const invoke = sandbox.stub(wsl, 'execWslSync').returns({ code: 0, stdout: '41ed\n', stderr: '' });
        const file = '/tmp/a b;$(marker)&%PATH%!x!';
        assert.strictEqual(wslFs.statSync(file).isDirectory(), true);
        sinon.assert.calledOnceWithExactly(invoke, ['env', 'LC_ALL=C', 'stat', '-L', '-c', '%f', '--', file]);
        invoke.returns({ code: 0, stdout: '81a4\n', stderr: '' });
        assert.strictEqual(wslFs.statSync(file).isDirectory(), false);
        invoke.returns({ code: 1, stdout: '', stderr: 'No such file or directory' });
        assert.strictEqual(wslFs.statSync(file).isDirectory(), false);
        invoke.returns({ code: 1, stdout: '', stderr: 'Permission denied' });
        assert.throws(() => wslFs.statSync(file), /Permission denied/);
    });

    test('determines file type from numeric mode rather than English text', () => {
        const invoke = sandbox.stub(wsl, 'execWslSync').returns({ code: 0, stdout: '41ed\n', stderr: '' });
        assert.strictEqual(wslFs.statSync('/path').isDirectory(), true);
        assert.deepStrictEqual(invoke.lastCall.args[0], ['env', 'LC_ALL=C', 'stat', '-L', '-c', '%f', '--', '/path']);
        invoke.returns({ code: 0, stdout: 'not a mode', stderr: '' });
        assert.throws(() => wslFs.statSync('/path'), /invalid file mode/);
    });

    test('preserves backslashes in absolute guest paths for reads and deletion', () => {
        const invoke = sandbox.stub(wsl, 'execWslSync').returns({ code: 0, stdout: '41ed\n', stderr: '' });
        const path = '/tmp/chart\\name';
        wslFs.statSync(path);
        assert.strictEqual(invoke.lastCall.args[0].slice(-1)[0], path);
        wslFs.existsSync(path);
        assert.strictEqual(invoke.lastCall.args[0].slice(-1)[0], path);
        wslFs.unlinkSync(path);
        assert.strictEqual(invoke.lastCall.args[0].slice(-1)[0], path);
        shell.cat(path);
        assert.strictEqual(invoke.lastCall.args[0].slice(-1)[0], path);
        shell.ls(path);
        assert.strictEqual(invoke.lastCall.args[0].slice(-1)[0], path);
    });

    test('still normalizes host-joined guest paths', () => {
        assert.strictEqual(wsl.normalizeWslPath('\\home\\user\\chart'), '/home/user/chart');
        assert.strictEqual(wsl.normalizeWslPath('/home/user/chart'), '/home/user/chart');
    });

    test('tests existence without listing or interpreting the path', () => {
        const invoke = sandbox.stub(wsl, 'execWslSync').returns({ code: 0, stdout: '', stderr: '' });
        assert.strictEqual(wslFs.existsSync('/tmp/-option & marker'), true);
        sinon.assert.calledOnceWithExactly(invoke, ['test', '-e', '/tmp/-option & marker']);
        invoke.returns({ code: 1, stdout: '', stderr: '' });
        assert.strictEqual(wslFs.existsSync('/missing'), false);
    });

    test('deletes only in WSL and never falls through to host deletion', () => {
        const invoke = sandbox.stub(wsl, 'execWslSync').returns({ code: 0, stdout: '', stderr: '' });
        const unlinkHost = sandbox.stub(nativeFs, 'unlinkSync');
        wslFs.unlinkSync('/tmp/chart & marker');
        sinon.assert.calledOnceWithExactly(invoke, ['rm', '-rf', '--', '/tmp/chart & marker']);
        sinon.assert.notCalled(unlinkHost);
        invoke.returns({ code: 1, stdout: '', stderr: 'denied' });
        assert.throws(() => wslFs.unlinkSync('/tmp/chart'), /denied/);
        sinon.assert.notCalled(unlinkHost);
    });

    test('keeps host filesystem behavior unchanged when WSL is disabled', () => {
        (config.getUseWsl as sinon.SinonStub).returns(false);
        const invoke = sandbox.stub(wsl, 'execWslSync');
        const exists = sandbox.stub(nativeFs, 'existsSync').returns(true);
        const stat = sandbox.stub(nativeFs, 'statSync').returns({ isDirectory: () => true } as nativeFs.Stats);
        const unlink = sandbox.stub(nativeFs, 'unlinkSync');
        assert.strictEqual(wslFs.existsSync('/host/file'), true);
        assert.strictEqual(wslFs.statSync('/host/file').isDirectory(), true);
        wslFs.unlinkSync('/host/file');
        sinon.assert.calledOnce(exists);
        sinon.assert.calledOnce(stat);
        sinon.assert.calledOnce(unlink);
        sinon.assert.notCalled(invoke);
    });

    test('uses literal argv for home, which, cat, and ls helpers', () => {
        const invoke = sandbox.stub(wsl, 'execWslSync').returns({ code: 0, stdout: '/home/user\n', stderr: '' });
        assert.strictEqual(shell.home(), '/home/user');
        assert.deepStrictEqual(invoke.lastCall.args[0], ['printenv', 'HOME']);
        shell.which('tool&marker');
        assert.deepStrictEqual(invoke.lastCall.args[0], ['sh', '-c', 'exec env VSCODE_KUBERNETES_TOOL="$1" "${SHELL:-/bin/sh}" -c \'which -- "$VSCODE_KUBERNETES_TOOL"\'', 'vscode-kubernetes-which', 'tool&marker']);
        shell.cat('/tmp/file "quoted" & marker');
        assert.deepStrictEqual(invoke.lastCall.args[0], ['cat', '--', '/tmp/file "quoted" & marker']);
        shell.ls('/tmp/folder;$(marker)');
        assert.deepStrictEqual(invoke.lastCall.args[0], ['ls', '-1', '--', '/tmp/folder;$(marker)']);
    });

    test('reads the default kubeconfig path with a fixed guest-variable script', () => {
        sandbox.stub(config, 'getActiveKubeconfig').returns(undefined);
        const path = '/home/user/config & marker ';
        const invoke = sandbox.stub(wsl, 'execWslSync').returns({ code: 0, stdout: path, stderr: '' });
        assert.deepStrictEqual(getKubeconfigPath(), { pathType: 'wsl', wslPath: path });
        sinon.assert.calledOnceWithExactly(invoke, ['sh', '-c', 'printf "%s" "${KUBECONFIG:-$HOME/.kube/config}"']);
    });

    test('discovers tools using default-shell PATH initialization with literal names', function () {
        if (process.platform === 'win32' || !nativeFs.existsSync('/bin/zsh')) { this.skip(); }
        const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'wsl-discovery-'));
        const bin = path.join(directory, 'bin');
        nativeFs.mkdirSync(bin);
        nativeFs.writeFileSync(path.join(directory, '.zshenv'), 'export PATH="$VSCODE_TEST_TOOL_DIR:$PATH"\n');
        const tool = path.join(bin, 'tool&literal');
        nativeFs.writeFileSync(tool, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
        sandbox.stub(wsl, 'execWslSync').callsFake((args) => {
            const result = childProcesses.spawnSync(args[0], args.slice(1), {
                encoding: 'utf8', shell: false,
                env: { ...process.env, SHELL: '/bin/zsh', ZDOTDIR: directory, VSCODE_TEST_TOOL_DIR: bin, PATH: '/usr/bin:/bin' },
            });
            return { code: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
        });
        try {
            assert.strictEqual(shell.which('tool&literal')?.trim(), tool);
        } finally {
            nativeFs.rmSync(directory, { recursive: true, force: true });
        }
    });

    test('uses configured kubeconfig paths only as data when reading content', async () => {
        const path = '/home/user/config & marker;$(echo x)';
        sandbox.stub(config, 'getActiveKubeconfig').returns(path);
        const invoke = sandbox.stub(wsl, 'execWslSync').returns({
            code: 0, stdout: 'apiVersion: v1\nkind: Config\nclusters: []\ncontexts: []\nusers: []\n', stderr: '',
        });
        await loadKubeconfig();
        sinon.assert.calledOnceWithExactly(invoke, ['env', 'LC_ALL=C', 'cat', '--', path]);
    });

    test('merges a WSL kubeconfig list without treating it as one filename', async () => {
        sandbox.stub(config, 'getActiveKubeconfig').returns('/first & config:/second;config');
        const invoke = sandbox.stub(wsl, 'execWslSync').callsFake((args) => {
            if (args[4] === '/first & config') { return { code: 0, stdout: kubeconfigText('first'), stderr: '' }; }
            if (args[4] === '/second;config') { return { code: 0, stdout: kubeconfigText('second'), stderr: '' }; }
            return { code: 1, stdout: '', stderr: 'No such file' };
        });
        const kubeconfig = await loadKubeconfig();
        assert.strictEqual(kubeconfig.getCurrentContext(), 'first');
        assert.deepStrictEqual(kubeconfig.getContexts().map((context: { name: string }) => context.name), ['first', 'second']);
        assert.deepStrictEqual(invoke.args.map((call) => call[0]), [['env', 'LC_ALL=C', 'cat', '--', '/first & config'], ['env', 'LC_ALL=C', 'cat', '--', '/second;config']]);
    });

    test('splits WSL kubeconfig paths using the guest separator and ignores empty entries', () => {
        assert.deepStrictEqual(getKubeconfigFiles({ pathType: 'wsl', wslPath: ':/a & b::/c;d:' }), ['/a & b', '/c;d']);
        assert.deepStrictEqual(getKubeconfigFiles({ pathType: 'host', hostPath: `first${path.delimiter}second` }), ['first', 'second']);
    });

    test('preserves host kubeconfig loading and the first selected context', async () => {
        (config.getUseWsl as sinon.SinonStub).returns(false);
        sandbox.stub(config, 'getActiveKubeconfig').returns(`first${path.delimiter}second`);
        sandbox.stub(nativeFs, 'readFileSync').withArgs(sinon.match.in(['first', 'second'])).returns('{}');
        const kubernetes = await import('@kubernetes/client-node');
        const load = sandbox.stub(kubernetes.KubeConfig.prototype, 'loadFromFile').callsFake(function (this: KubeConfig, file: string) {
            this.loadFromString(kubeconfigText(file));
        });
        const invoke = sandbox.stub(wsl, 'execWslSync');
        const kubeconfig = await loadKubeconfig();
        assert.strictEqual(kubeconfig.getCurrentContext(), 'first');
        assert.deepStrictEqual(load.args, [['first'], ['second']]);
        sinon.assert.notCalled(invoke);
    });

    test('rejects an empty kubeconfig list without starting WSL', async () => {
        sandbox.stub(config, 'getActiveKubeconfig').returns('::');
        const invoke = sandbox.stub(wsl, 'execWslSync');
        await assert.rejects(loadKubeconfig(), /No kubeconfig paths specified/);
        sinon.assert.notCalled(invoke);
    });

    test('skips missing and empty WSL sources, including the first and middle entries', async () => {
        sandbox.stub(config, 'getActiveKubeconfig').returns('/missing:/empty:/first:/missing-middle:/blank:/second');
        sandbox.stub(wsl, 'execWslSync').callsFake((args) => {
            const file = args[4];
            if (file.startsWith('/missing')) { return { code: 1, stdout: '', stderr: 'cat: No such file or directory' }; }
            return { code: 0, stdout: file === '/empty' ? '' : file === '/blank' ? ' \n\t' : kubeconfigText(file), stderr: '' };
        });
        const kubeconfig = await loadKubeconfig();
        assert.strictEqual(kubeconfig.getCurrentContext(), '/first');
        assert.deepStrictEqual(kubeconfig.getContexts().map((context: { name: string }) => context.name), ['/first', '/second']);
    });

    test('returns an empty config when every WSL source is missing', async () => {
        sandbox.stub(config, 'getActiveKubeconfig').returns('/missing:/also-missing');
        sandbox.stub(wsl, 'execWslSync').returns({ code: 1, stdout: '', stderr: 'cat: No such file or directory' });
        assert.deepStrictEqual((await loadKubeconfig()).getContexts(), []);
    });

    test('reports the WSL source path for permissions and malformed content', async () => {
        sandbox.stub(config, 'getActiveKubeconfig').returns('/private');
        const invoke = sandbox.stub(wsl, 'execWslSync').returns({ code: 1, stdout: '', stderr: 'Permission denied' });
        await assert.rejects(loadKubeconfig(), /\/private.*Permission denied/);
        invoke.returns({ code: 0, stdout: '[invalid', stderr: '' });
        await assert.rejects(loadKubeconfig(), /\/private/);
    });

    test('keeps first named entries and the first nonempty current context', async () => {
        sandbox.stub(config, 'getActiveKubeconfig').returns('/empty-context:/first:/last:/first');
        const first = JSON.parse(kubeconfigText('shared'));
        first['current-context'] = 'A';
        const last = JSON.parse(kubeconfigText('shared'));
        last['current-context'] = 'B';
        last.clusters[0].cluster.server = 'https://later.invalid';
        last.users[0].user.token = 'later';
        last.contexts[0].context.namespace = 'later';
        const invoke = sandbox.stub(wsl, 'execWslSync').callsFake((args) => ({
            code: 0, stderr: '', stdout: args[4] === '/empty-context' ? '{}' : JSON.stringify(args[4] === '/first' ? first : last),
        }));
        const kubeconfig = await loadKubeconfig();
        assert.strictEqual(kubeconfig.getCurrentContext(), 'A');
        assert.strictEqual(kubeconfig.getClusters().length, 1);
        assert.strictEqual(kubeconfig.getClusters()[0].server, 'https://example.invalid');
        assert.strictEqual(kubeconfig.getUsers().length, 1);
        assert.strictEqual(kubeconfig.getUsers()[0].token, undefined);
        assert.strictEqual(kubeconfig.getContexts().length, 1);
        assert.strictEqual(kubeconfig.getContexts()[0].namespace, undefined);
        assert.strictEqual(invoke.callCount, 3);
    });

    test('skips missing and blank host sources but preserves other read errors', async () => {
        (config.getUseWsl as sinon.SinonStub).returns(false);
        sandbox.stub(config, 'getActiveKubeconfig').returns(['missing', 'blank', 'valid'].join(path.delimiter));
        const read = sandbox.stub(nativeFs, 'readFileSync');
        read.withArgs('missing').throws(Object.assign(new Error('missing'), { code: 'ENOENT' }));
        read.withArgs('blank').returns(' \n');
        read.withArgs('valid').returns(kubeconfigText('valid'));
        const kubernetes = await import('@kubernetes/client-node');
        const load = sandbox.stub(kubernetes.KubeConfig.prototype, 'loadFromFile').callsFake(function (this: KubeConfig) {
            this.loadFromString(kubeconfigText('valid'));
        });
        assert.strictEqual((await loadKubeconfig()).getCurrentContext(), 'valid');
        sinon.assert.calledOnceWithExactly(load, 'valid');
        read.withArgs('missing').throws(Object.assign(new Error('permission denied'), { code: 'EACCES' }));
        await assert.rejects(loadKubeconfig(), /missing.*permission denied/);
    });
});

function kubeconfigText(name: string): string {
    return JSON.stringify({
        apiVersion: 'v1', kind: 'Config', 'current-context': name,
        contexts: [{ name, context: { cluster: name, user: name } }],
        clusters: [{ name, cluster: { server: 'https://example.invalid' } }],
        users: [{ name, user: {} }],
    });
}

function restoreEnvironmentVariable(name: string, value: string | undefined): void {
    if (value === undefined) {
        delete process.env[name];
    } else {
        process.env[name] = value;
    }
}
