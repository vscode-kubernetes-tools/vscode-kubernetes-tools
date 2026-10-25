import * as assert from 'assert';
import * as nativeFs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { Uri, window, workspace } from 'vscode';
import * as config from '../../../../src/components/config/config';
import * as processApi from '../../../../src/process';
import { FS } from '../../../../src/fs';
import { Host } from '../../../../src/host';
import { Platform, Shell } from '../../../../src/shell';
import { minikubeLifecycleArgs, minikubeStartCommand, parseAdditionalFlags } from '../../../../src/components/clusterprovider/minikube/commands';
import { create, createOnBinary } from '../../../../src/components/clusterprovider/minikube/minikube';

suite('Minikube command security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => { sandbox = sinon.createSandbox(); });
    teardown(() => sandbox.restore());

    test('parses portable quoted flags without interpreting punctuation', () => {
        assert.deepStrictEqual(parseAdditionalFlags('--profile "team cluster" --extra-config=apiserver.audit-policy-file=$(marker)'), {
            succeeded: true,
            result: ['--profile', 'team cluster', '--extra-config=apiserver.audit-policy-file=$(marker)'],
        });
        assert.deepStrictEqual(minikubeStartCommand({
            vmDriver: 'hyperkit',
            additionalFlags: '--profile "team cluster" --cpus=4',
        }), {
            succeeded: true,
            result: {
                args: ['start', '--profile', 'team cluster', '--cpus=4', '--vm-driver=hyperkit'],
                profile: 'team cluster',
            },
        });
        assert.deepStrictEqual(minikubeStartCommand({ vmDriver: 'docker' }), {
            succeeded: true,
            result: { args: ['start', '--vm-driver=docker'], profile: undefined },
        });
        assert.deepStrictEqual(minikubeLifecycleArgs('status', 'team cluster'), ['--profile', 'team cluster', 'status']);
    });

    test('rejects shell syntax, malformed quoting, and unknown drivers', () => {
        for (const value of [
            '--profile demo; touch marker',
            '--profile demo && touch marker',
            '--profile demo | marker',
            '--profile demo > marker',
            '--profile `marker`',
            '--profile "unterminated',
            '--profile demo\nmarker',
            'delete --all',
        ]) {
            assert.strictEqual(parseAdditionalFlags(value).succeeded, false, value);
        }
        assert.strictEqual(minikubeStartCommand({ vmDriver: '$(marker)' }).succeeded, false);
        assert.strictEqual(minikubeStartCommand({ additionalFlags: '--profile one --profile two' }).succeeded, false);
        assert.strictEqual(minikubeStartCommand({ additionalFlags: '-pcompact' }).succeeded, true);
        const compact = minikubeStartCommand({ additionalFlags: '-pcompact' });
        if (compact.succeeded) {
            assert.strictEqual(compact.result.profile, 'compact');
        }
    });

    test('preserves literal Windows and UNC backslashes in flag values', () => {
        assert.deepStrictEqual(parseAdditionalFlags('--mount-string "\\\\server\\share:/host" --ssh-key C:\\Keys\\id_rsa'), {
            succeeded: true,
            result: ['--mount-string', '\\\\server\\share:/host', '--ssh-key', 'C:\\Keys\\id_rsa'],
        });
    });

    test('passes exact native arguments to a configured path with spaces', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: 'ok', stderr: '' });
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(false), '/opt/Mini Kube/minikube');

        const args = ['status', '--profile', 'team;$(marker)'];
        assert.deepStrictEqual(await minikube.invokeCommand(args), { code: 0, stdout: 'ok', stderr: '' });
        sinon.assert.calledOnceWithExactly(execute, {
            executable: '/opt/Mini Kube/minikube',
            args,
            cwd: '/workspace',
            env: { PATH: '/usr/bin' },
        });
    });

    test('uses wsl.exe --exec with the configured guest binary', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: 'ok', stderr: '' });
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(false, windowsEnvironment()), '/home/user/Mini Kube/minikube');

        await minikube.invokeCommand(['help', 'value;$(marker)']);
        sinon.assert.calledOnceWithExactly(execute, {
            executable: 'C:\\Windows\\System32\\wsl.exe',
            args: ['--exec', '/home/user/Mini Kube/minikube', 'help', 'value;$(marker)'],
            cwd: '/workspace',
            env: windowsEnvironment(),
        });
    });

    test('pins an unconfigured native Minikube executable resolved from PATH', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(config, 'getToolPath').returns(undefined);
        const alias = systemExecutable();
        const executable = nativeFs.realpathSync.native(alias);
        const cwd = os.tmpdir();
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: 'ok', stderr: '' });
        const minikube = create(
            fakeHost(),
            fakeFs(),
            fakeShell(process.platform === 'win32', { PATH: path.dirname(alias) }, cwd, alias)
        );

        const result = await minikube.invokeCommand(['status']);
        assert.deepStrictEqual(result, { code: 0, stdout: 'ok', stderr: '' }, JSON.stringify(execute.args.map((call) => call[0].args)));
        sinon.assert.calledOnceWithExactly(execute, {
            executable,
            args: ['status'],
            argv0: alias,
            cwd,
            env: { PATH: path.dirname(alias) },
        });
    });

    test('rejects an unconfigured native executable resolved from the workspace', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(config, 'getToolPath').returns(undefined);
        const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'minikube-workspace-'));
        const bin = path.join(directory, 'bin');
        const alias = path.join(bin, process.platform === 'win32' ? 'minikube.exe' : 'minikube');
        nativeFs.mkdirSync(bin);
        nativeFs.symlinkSync(systemExecutable(), alias, 'file');
        sandbox.stub(workspace, 'workspaceFolders').value([{
            uri: Uri.file(directory), name: 'workspace', index: 0,
        }]);
        const execute = sandbox.stub(processApi, 'executeCommand');
        const minikube = create(fakeHost(), fakeFs(), fakeShell(
            process.platform === 'win32', { PATH: bin }, directory, alias
        ));

        try {
            assert.strictEqual(await minikube.invokeCommand(['status']), undefined);
            sinon.assert.notCalled(execute);
        } finally {
            nativeFs.rmSync(directory, { recursive: true, force: true });
        }
    });

    test('pins an unconfigured guest Minikube executable before execution', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        sandbox.stub(config, 'getToolPath').returns(undefined);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const execute = sandbox.stub(processApi, 'executeCommand').callsFake(async (invocation) => {
            const args = invocation.args;
            if (args[1] === '/usr/bin/which') { return { code: 0, stdout: '/usr/local/bin/minikube\n', stderr: '' }; }
            if (args[1] === '/usr/bin/test') { return { code: 0, stdout: '', stderr: '' }; }
            if (args[1] === '/usr/bin/readlink' && args[3] === '/usr/local/bin/minikube') {
                return { code: 0, stdout: '/opt/minikube/minikube\n', stderr: '' };
            }
            if (args[1] === '/usr/bin/readlink' && args[3] === '/usr/local/bin') {
                return { code: 0, stdout: '/usr/local/bin\n', stderr: '' };
            }
            if (args[1] === '/usr/bin/readlink') { return { code: 0, stdout: `${args[3]}\n`, stderr: '' }; }
            return { code: 0, stdout: 'ok', stderr: '' };
        });
        const minikube = create(fakeHost(), fakeFs(), fakeShell(false, windowsEnvironment()));

        const result = await minikube.invokeCommand(['status']);
        assert.deepStrictEqual(result, { code: 0, stdout: 'ok', stderr: '' });
        assert.ok(execute.args.some((call) => call[0].args.join('\0') === ['--exec', '/usr/bin/which', 'minikube'].join('\0')));
        assert.ok(execute.args.some((call) => call[0].args.join('\0') === ['--exec', '/usr/local/bin/minikube', 'status'].join('\0')));
        for (const call of execute.args) {
            assert.strictEqual(call[0].executable, 'C:\\Windows\\System32\\wsl.exe');
        }
    });

    test('rejects an unconfigured WSL executable resolved inside the workspace', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        sandbox.stub(config, 'getToolPath').returns(undefined);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const execute = sandbox.stub(processApi, 'executeCommand').callsFake(async (invocation) => {
            const args = invocation.args;
            if (args[1] === '/usr/bin/which') { return { code: 0, stdout: '/workspace/bin/minikube\n', stderr: '' }; }
            if (args[1] === '/usr/bin/test') { return { code: 0, stdout: '', stderr: '' }; }
            if (args[1] === '/usr/bin/readlink' && args[3] === '/workspace/bin') {
                return { code: 0, stdout: '/workspace/bin\n', stderr: '' };
            }
            if (args[1] === '/usr/bin/readlink') { return { code: 0, stdout: `${args[3]}\n`, stderr: '' }; }
            return { code: 0, stdout: 'unexpected launch', stderr: '' };
        });
        const minikube = create(fakeHost(), fakeFs(), fakeShell(false, windowsEnvironment()));

        assert.strictEqual(await minikube.invokeCommand(['status']), undefined);
        assert.ok(!execute.args.some((call) => call[0].args.join('\0') === ['--exec', '/workspace/bin/minikube', 'status'].join('\0')));
    });

    test('checks and uses a configured WSL path as one argument', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        sandbox.stub(config, 'getToolPath').returns('/home/user/Mini Kube/minikube');
        const execute = sandbox.stub(processApi, 'executeCommand');
        execute.onFirstCall().resolves({ code: 0, stdout: '', stderr: '' });
        execute.onSecondCall().resolves({ code: 0, stdout: 'ok', stderr: '' });
        const minikube = create(fakeHost(), fakeFs(), fakeShell(false, windowsEnvironment()));

        assert.deepStrictEqual(await minikube.invokeCommand(['status']), { code: 0, stdout: 'ok', stderr: '' });
        sinon.assert.calledWithExactly(execute.firstCall, {
            executable: 'C:\\Windows\\System32\\wsl.exe',
            args: ['--exec', '/usr/bin/test', '-x', '/home/user/Mini Kube/minikube'],
            cwd: '/workspace',
            env: windowsEnvironment(),
        });
        sinon.assert.calledWithExactly(execute.secondCall, {
            executable: 'C:\\Windows\\System32\\wsl.exe',
            args: ['--exec', '/home/user/Mini Kube/minikube', 'status'],
            cwd: '/workspace',
            env: windowsEnvironment(),
        });
    });

    test('routes update-check, help, and status through argv', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(config, 'getCheckForMinikubeUpgrade').returns(true);
        const execute = sandbox.stub(processApi, 'executeCommand');
        execute.onFirstCall().resolves({ code: 0, stdout: 'CurrentVersion: v1\nLatestVersion: v1\n', stderr: '' });
        execute.onSecondCall().resolves({ code: 0, stdout: 'help', stderr: '' });
        execute.onThirdCall().resolves({ code: 0, stdout: 'host: Running\n', stderr: '' });
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(false), '/usr/local/bin/minikube');

        await minikube.checkUpgradeAvailable();
        assert.strictEqual((await minikube.isRunnable()).succeeded, true);
        assert.strictEqual((await minikube.status()).running, true);
        assert.deepStrictEqual(execute.args.map((call) => call[0].args), [
            ['update-check'], ['help'], ['status'],
        ]);
    });

    test('routes start and stop through validated argv', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const execute = sandbox.stub(processApi, 'executeCommand');
        execute.onFirstCall().resolves({ code: 0, stdout: 'host: Stopped\n', stderr: '' });
        execute.onSecondCall().resolves({ code: 0, stdout: 'started', stderr: '' });
        execute.onThirdCall().resolves({ code: 0, stdout: 'host: Running\n', stderr: '' });
        execute.onCall(3).resolves({ code: 0, stdout: 'stopped', stderr: '' });
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(false), '/usr/local/bin/minikube');

        await minikube.start({ vmDriver: 'kvm2', additionalFlags: '--profile "team cluster"' });
        await minikube.stop();
        assert.deepStrictEqual(execute.args.map((call) => call[0].args), [
            ['--profile', 'team cluster', 'status'],
            ['start', '--profile', 'team cluster', '--vm-driver=kvm2'],
            ['--profile', 'team cluster', 'status'],
            ['--profile', 'team cluster', 'stop'],
        ]);
    });

    test('starts a profile that does not exist yet', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const execute = sandbox.stub(processApi, 'executeCommand');
        execute.onFirstCall().resolves({ code: 85, stdout: '', stderr: 'Profile "new profile" not found' });
        execute.onSecondCall().resolves({ code: 0, stdout: 'started', stderr: '' });
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(false), '/usr/local/bin/minikube');

        assert.strictEqual(await minikube.start({ additionalFlags: '--profile "new profile"' }), true);
        assert.deepStrictEqual(execute.args.map((call) => call[0].args), [
            ['--profile', 'new profile', 'status'],
            ['start', '--profile', 'new profile'],
        ]);
    });

    test('starts the default profile when it does not exist yet', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const execute = sandbox.stub(processApi, 'executeCommand');
        execute.onFirstCall().resolves({ code: 85, stdout: '', stderr: 'Profile "minikube" not found' });
        execute.onSecondCall().resolves({ code: 0, stdout: 'started', stderr: '' });
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(false), '/usr/local/bin/minikube');

        assert.strictEqual(await minikube.start({}), true);
        assert.deepStrictEqual(execute.args.map((call) => call[0].args), [['status'], ['start']]);
    });

    test('treats Minikube stopped status bit flags as valid status output', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(processApi, 'executeCommand').resolves({ code: 7, stdout: 'host: Stopped\n', stderr: '' });
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(false), '/usr/local/bin/minikube');

        assert.deepStrictEqual(await minikube.status(), { running: false, message: 'host: Stopped\n' });
    });

    test('rejects invalid start options before status or execution', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const execute = sandbox.stub(processApi, 'executeCommand');
        const showError = sandbox.stub(window, 'showErrorMessage').resolves(undefined);
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(false), '/usr/local/bin/minikube');

        await minikube.start({ vmDriver: 'none; marker' });
        sinon.assert.notCalled(execute);
        sinon.assert.calledWith(showError, sinon.match('Invalid Minikube VM driver'));
    });

    test('rejects Windows command scripts without invoking a shell', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const execute = sandbox.stub(processApi, 'executeCommand');
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(true), 'C:\\Tools\\minikube.cmd');

        assert.strictEqual(await minikube.invokeCommand(['status']), undefined);
        sinon.assert.notCalled(execute);
    });

    test('preserves process launch diagnostics', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(processApi, 'executeCommand').rejects(new Error('launch failed'));
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(false), '/usr/local/bin/minikube');

        assert.deepStrictEqual(await minikube.invokeCommand(['status']), {
            code: -1,
            stdout: '',
            stderr: 'launch failed',
        });
    });
});

function fakeHost(): Host {
    return {
        showErrorMessage: async () => undefined,
        showWarningMessage: async () => undefined,
        showInformationMessage: async () => undefined,
    } as unknown as Host;
}

function fakeFs(): FS {
    return { existsAsync: async () => true } as unknown as FS;
}

function fakeShell(
    windows: boolean,
    env: NodeJS.ProcessEnv = { PATH: '/usr/bin' },
    cwd = '/workspace',
    executable?: string
): Shell {
    return {
        isWindows: () => windows,
        isUnix: () => !windows,
        platform: () => windows ? Platform.Windows : Platform.Linux,
        execOpts: () => ({ cwd, env }),
        which: () => executable || null,
    } as unknown as Shell;
}

function windowsEnvironment(): NodeJS.ProcessEnv {
    return { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' };
}

function systemExecutable(): string {
    return process.platform === 'win32' ?
        path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'where.exe') :
        '/usr/bin/env';
}
