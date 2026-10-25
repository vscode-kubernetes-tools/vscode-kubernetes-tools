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
import { create, createOnBinary, Minikube } from '../../../../src/components/clusterprovider/minikube/minikube';
import { createCluster, waitForClusterOnce } from '../../../../src/components/clusterprovider/minikube/minikubeclusterprovider';
import { propagationFields } from '../../../../src/components/clusterprovider/common/form';

suite('Minikube command security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => { sandbox = sinon.createSandbox(); });
    teardown(() => sandbox.restore());

    test('parses portable quoted flags without interpreting punctuation', () => {
        assert.deepStrictEqual(parseAdditionalFlags('--ssh-key "team key" --extra-config=apiserver.audit-policy-file=$(marker)'), {
            succeeded: true,
            result: ['--ssh-key', 'team key', '--extra-config=apiserver.audit-policy-file=$(marker)'],
        });
        assert.deepStrictEqual(minikubeStartCommand({
            vmDriver: 'hyperkit',
            additionalFlags: '--ssh-key "team key" --cpus=4',
            profile: 'team-cluster',
        }), {
            succeeded: true,
            result: {
                args: ['start', '--ssh-key', 'team key', '--cpus=4', '--vm-driver=hyperkit', '--profile=team-cluster'],
                profile: 'team-cluster',
            },
        });
        assert.deepStrictEqual(minikubeStartCommand({ vmDriver: 'docker' }), {
            succeeded: true,
            result: { args: ['start', '--vm-driver=docker'], profile: undefined },
        });
        assert.deepStrictEqual(minikubeLifecycleArgs('status', 'team-cluster'), ['--profile', 'team-cluster', 'status']);
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
            '--profile demo\\\nmarker',
            '--profile demo\u001bmarker',
            '--profile demo\u007fmarker',
            '--profile demo\u0085marker',
            'delete --all',
        ]) {
            assert.strictEqual(parseAdditionalFlags(value).succeeded, false, value);
        }
        assert.strictEqual(minikubeStartCommand({ vmDriver: '$(marker)' }).succeeded, false);
        assert.strictEqual(minikubeStartCommand({ additionalFlags: '--cpus=4 -- marker' }).succeeded, false);
        assert.strictEqual(minikubeStartCommand({ profile: 'team cluster' }).succeeded, false);
    });

    test('keeps option values opaque and appends an authoritative profile', () => {
        assert.deepStrictEqual(minikubeStartCommand({
            additionalFlags: '--ssh-key "-pkey" --cpus 4 --profile other',
            profile: 'team',
        }), {
            succeeded: true,
            result: {
                args: ['start', '--ssh-key', '-pkey', '--cpus', '4', '--profile', 'other', '--profile=team'],
                profile: 'team',
            },
        });
        assert.deepStrictEqual(minikubeStartCommand({ additionalFlags: '--ssh-key "-pkey"', profile: '' }), {
            succeeded: true,
            result: { args: ['start', '--ssh-key', '-pkey', '--profile=minikube'], profile: 'minikube' },
        });
        assert.deepStrictEqual(minikubeStartCommand({ additionalFlags: '--ssh-key=-pkey' }), {
            succeeded: true,
            result: { args: ['start', '--ssh-key=-pkey'], profile: undefined },
        });
        for (const profile of ['team', 'team-1', 'a.b', 'A1']) {
            assert.strictEqual(minikubeStartCommand({ profile }).succeeded, true, profile);
        }
        for (const profile of ['a', '-team', 'team-', '.team', 'team_name', 'team cluster']) {
            assert.strictEqual(minikubeStartCommand({ profile }).succeeded, false, profile);
        }
    });

    test('normalizes a leading compatibility profile without scanning option values', () => {
        for (const additionalFlags of [
            '--profile team --ssh-key "-pkey"',
            '--profile=team --ssh-key "-pkey"',
            '-p team --ssh-key "-pkey"',
            '-p=team --ssh-key "-pkey"',
            '-pteam --ssh-key "-pkey"',
        ]) {
            const command = minikubeStartCommand({ additionalFlags });
            assert.strictEqual(command.succeeded, true, additionalFlags);
            if (command.succeeded) {
                assert.deepStrictEqual(command.result, {
                    args: ['start', '--ssh-key', '-pkey', '--profile=team'],
                    profile: 'team',
                });
            }
        }
    });

    test('escapes values propagated through hidden form fields', () => {
        assert.strictEqual(propagationFields({
            "field'name": `--ssh-key 'team' & < > "`,
            nextStep: 'ignored',
        }), `<input type='hidden' name='field&#39;name' value='--ssh-key &#39;team&#39; &amp; &lt; &gt; &quot;' />\n`);
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

    test('re-resolves an inferred executable when WSL mode changes', async () => {
        let useWsl = false;
        sandbox.stub(config, 'getUseWsl').callsFake(() => useWsl);
        sandbox.stub(config, 'getToolPath').returns(undefined);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const alias = systemExecutable();
        const env = windowsEnvironment({ PATH: path.dirname(alias) });
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
        const minikube = create(fakeHost(), fakeFs(), fakeShell(
            process.platform === 'win32', env, os.tmpdir(), alias
        ));

        assert.deepStrictEqual(await minikube.invokeCommand(['status']), { code: 0, stdout: 'ok', stderr: '' });
        useWsl = true;
        assert.deepStrictEqual(await minikube.invokeCommand(['status']), { code: 0, stdout: 'ok', stderr: '' });
        useWsl = false;
        assert.deepStrictEqual(await minikube.invokeCommand(['status']), { code: 0, stdout: 'ok', stderr: '' });

        assert.deepStrictEqual(execute.args.filter((call) => call[0].args.length === 1).map((call) => call[0].executable), [
            nativeFs.realpathSync.native(alias),
            nativeFs.realpathSync.native(alias),
        ]);
        assert.ok(execute.args.some((call) => call[0].args.join('\0') === [
            '--exec', '/usr/local/bin/minikube', 'status',
        ].join('\0')));
        assert.ok(!execute.args.some((call) => call[0].args[1] === nativeFs.realpathSync.native(alias)));
    });

    test('does not reinterpret a fixed binary after WSL mode changes', async () => {
        let useWsl = false;
        sandbox.stub(config, 'getUseWsl').callsFake(() => useWsl);
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: 'ok', stderr: '' });
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(false, windowsEnvironment()), '/usr/local/bin/minikube');

        assert.deepStrictEqual(await minikube.invokeCommand(['status']), { code: 0, stdout: 'ok', stderr: '' });
        useWsl = true;
        assert.strictEqual(await minikube.invokeCommand(['status']), undefined);
        sinon.assert.calledOnce(execute);
    });

    test('treats an unset WSL setting as native mode', async () => {
        sandbox.stub(config, 'getUseWsl').returns(undefined as unknown as boolean);
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: 'ok', stderr: '' });
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(false), '/usr/local/bin/minikube');

        assert.deepStrictEqual(await minikube.invokeCommand(['status']), { code: 0, stdout: 'ok', stderr: '' });
        sinon.assert.calledOnceWithExactly(execute, {
            executable: '/usr/local/bin/minikube',
            args: ['status'],
            cwd: '/workspace',
            env: { PATH: '/usr/bin' },
        });
    });

    test('does not reuse an active profile after execution mode changes', async () => {
        let useWsl = false;
        sandbox.stub(config, 'getUseWsl').callsFake(() => useWsl);
        const execute = sandbox.stub(processApi, 'executeCommand');
        execute.onFirstCall().resolves({ code: 85, stdout: '', stderr: 'profile not found' });
        execute.onSecondCall().resolves({ code: 0, stdout: 'started', stderr: '' });
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(false), '/usr/local/bin/minikube');

        assert.strictEqual(await minikube.start({ profile: 'team' }), true);
        useWsl = true;
        await assert.rejects(() => minikube.status(), /execution mode changed/);
        sinon.assert.calledTwice(execute);
    });

    test('keeps an active profile after a later start is rejected', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const execute = sandbox.stub(processApi, 'executeCommand');
        execute.onFirstCall().resolves({ code: 85, stdout: '', stderr: 'profile not found' });
        execute.onSecondCall().resolves({ code: 0, stdout: 'started', stderr: '' });
        execute.onThirdCall().resolves({ code: 0, stdout: 'host: Running\n', stderr: '' });
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(false), '/usr/local/bin/minikube');

        assert.strictEqual(await minikube.start({ profile: 'team' }), true);
        assert.strictEqual(await minikube.start({ profile: 'bad profile' }), false);
        assert.strictEqual((await minikube.status()).running, true);
        assert.deepStrictEqual(execute.thirdCall.args[0].args, ['--profile', 'team', 'status']);
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

        await minikube.start({ vmDriver: 'kvm2', profile: 'team-cluster' });
        await minikube.stop();
        assert.deepStrictEqual(execute.args.map((call) => call[0].args), [
            ['--profile', 'team-cluster', 'status'],
            ['start', '--vm-driver=kvm2', '--profile=team-cluster'],
            ['--profile', 'team-cluster', 'status'],
            ['--profile', 'team-cluster', 'stop'],
        ]);
    });

    test('starts a profile that does not exist yet', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const execute = sandbox.stub(processApi, 'executeCommand');
        execute.onFirstCall().resolves({ code: 85, stdout: '', stderr: 'Profile "new-profile" not found' });
        execute.onSecondCall().resolves({ code: 0, stdout: 'started', stderr: '' });
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(false), '/usr/local/bin/minikube');

        assert.strictEqual(await minikube.start({ profile: 'new-profile' }), true);
        assert.deepStrictEqual(execute.args.map((call) => call[0].args), [
            ['--profile', 'new-profile', 'status'],
            ['start', '--profile=new-profile'],
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

    test('returns false when the start status preflight fails', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(processApi, 'executeCommand').resolves({ code: 1, stdout: '', stderr: 'status failed' });
        const showError = sandbox.stub(window, 'showErrorMessage').resolves(undefined);
        const minikube = createOnBinary(fakeHost(), fakeFs(), fakeShell(false), '/usr/local/bin/minikube');

        assert.strictEqual(await minikube.start({}), false);
        sinon.assert.calledWith(showError, sinon.match('status failed'));
    });

    test('renders a wizard failure when Minikube start rejects', async () => {
        const minikube = fakeMinikube({
            isRunnable: async () => ({ succeeded: true, result: { value: '' } }),
            start: async () => { throw new Error('status failed'); },
        });

        const html = await createCluster({ vmdriver: 'docker', profile: 'minikube', additionalflags: '' }, { minikube });
        assert.ok(html.includes('Error creating cluster'));
        assert.ok(html.includes('Unable to start Minikube.'));
    });

    test('reports invalid wait flags without polling the default profile', async () => {
        const invoke = sandbox.stub().resolves({ code: 0, stdout: 'host: Running\n', stderr: '' });
        const minikube = fakeMinikube({ invokeCommand: invoke });

        const [html, retry] = await waitForClusterOnce({
            vmdriver: 'docker',
            profile: 'bad profile',
            additionalflags: '',
        }, { minikube }, 0);

        assert.strictEqual(retry, false);
        assert.ok(html.includes('Invalid Minikube profile'));
        sinon.assert.notCalled(invoke);
    });

    test('polls the propagated profile and escapes additional flags', async () => {
        const invoke = sandbox.stub().resolves({ code: 1, stdout: '', stderr: 'still starting' });
        const minikube = fakeMinikube({ invokeCommand: invoke });

        const [html, retry] = await waitForClusterOnce({
            vmdriver: 'docker',
            profile: 'team',
            additionalflags: "--ssh-key 'team key'",
            minikubeusewsl: false,
        }, { minikube }, 0);

        assert.strictEqual(retry, true);
        sinon.assert.calledOnceWithExactly(invoke, ['--profile', 'team', 'status']);
        assert.ok(html.includes("value='--ssh-key &#39;team key&#39;'"));
    });

    test('stops polling when the Minikube execution mode changes', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const invoke = sandbox.stub();
        const minikube = fakeMinikube({ invokeCommand: invoke });

        const [html, retry] = await waitForClusterOnce({
            vmdriver: 'docker',
            profile: 'team',
            additionalflags: '',
            minikubeusewsl: false,
        }, { minikube }, 0);

        assert.strictEqual(retry, false);
        assert.ok(html.includes('execution mode changed'));
        sinon.assert.notCalled(invoke);
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

function fakeMinikube(overrides: Partial<Minikube>): Minikube {
    return {
        checkPresent: async () => true,
        checkUpgradeAvailable: async () => undefined,
        invokeCommand: async () => ({ code: 0, stdout: '', stderr: '' }),
        isRunnable: async () => ({ succeeded: true, result: { value: '' } }),
        start: async () => true,
        stop: async () => undefined,
        status: async () => ({ running: true, message: '' }),
        ...overrides,
    };
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

function windowsEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
    return { PATH: '/usr/bin', SystemRoot: 'C:\\Windows', ...overrides };
}

function systemExecutable(): string {
    return process.platform === 'win32' ?
        path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'where.exe') :
        '/usr/bin/env';
}
