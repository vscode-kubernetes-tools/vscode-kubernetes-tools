import * as assert from 'assert';
import * as nativeFs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { Uri, workspace, WorkspaceFolder } from 'vscode';
import * as config from '../../../../src/components/config/config';
import * as processApi from '../../../../src/process';
import { FS } from '../../../../src/fs';
import { Platform, Shell } from '../../../../src/shell';
import { azureCliHome, ensureAzureCliDirectory, executeAzureCli } from '../../../../src/components/clusterprovider/azure/azure-cli';
import {
    createClusterArgs,
    createResourceGroupArgs,
    getCredentialsArgs,
    installKubectlArgs,
    listClustersArgs,
    listLocationsArgs,
    listSubscriptionsArgs,
    listVmSizesArgs,
    setSubscriptionArgs,
    showResourceGroupArgs,
    waitForClusterArgs,
} from '../../../../src/components/clusterprovider/azure/commands';

suite('Azure CLI command security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => { sandbox = sinon.createSandbox(); });
    teardown(() => sandbox.restore());

    test('keeps Azure values and JMESPath queries in exact arguments', () => {
        const hostile = 'value & $(marker); %PATH%';
        assert.deepStrictEqual(setSubscriptionArgs(hostile), ['account', 'set', '--subscription', hostile]);
        assert.deepStrictEqual(listVmSizesArgs(hostile), ['vm', 'list-sizes', '-l', hostile, '-o', 'json']);
        assert.deepStrictEqual(showResourceGroupArgs(hostile), ['group', 'show', '-n', hostile, '-o', 'json']);
        assert.deepStrictEqual(createResourceGroupArgs(hostile, hostile), ['group', 'create', '-n', hostile, '-l', hostile]);
        assert.deepStrictEqual(listSubscriptionsArgs(), ['account', 'list', '--all', '--query', '[*].name', '-o', 'json']);
        assert.deepStrictEqual(listClustersArgs(), ['aks', 'list', '--query', '[].{name:name,resourceGroup:resourceGroup}', '-o', 'json']);
        assert.deepStrictEqual(listLocationsArgs(), ['account', 'list-locations', '--query', '[].{name:name,displayName:displayName}', '-o', 'json']);
    });

    test('builds cluster lifecycle and credential arguments', () => {
        const value = 'name & $(marker); value';
        assert.deepStrictEqual(createClusterArgs({
            metadata: { clusterName: value, resourceGroupName: value, location: value },
            agentSettings: { count: '3', vmSize: value },
        }), [
            'aks', 'create', '-n', value, '-g', value, '-l', value,
            '--generate-ssh-keys', '--no-wait', '--node-count', '3', '--node-vm-size', value,
        ]);
        assert.deepStrictEqual(waitForClusterArgs(value, value), [
            'aks', 'wait', '--created', '--interval', '5', '--timeout', '10',
            '-n', value, '-g', value, '-o', 'json',
        ]);
        assert.deepStrictEqual(getCredentialsArgs(value, value, '/home/user/kube config;$(marker)'), [
            'aks', 'get-credentials', '-n', value, '-g', value, '-f', '/home/user/kube config;$(marker)',
        ]);
        assert.deepStrictEqual(installKubectlArgs('/home/user/bin/kubectl'), [
            'aks', 'install-cli', '--install-location', '/home/user/bin/kubectl',
        ]);
    });

    test('pins a native Azure CLI executable from a trusted PATH entry', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const alias = systemExecutable();
        const executable = nativeFs.realpathSync.native(alias);
        const env = { PATH: path.dirname(alias) };
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: 'ok', stderr: '' });
        const context = fakeContext(fakeShell(process.platform === 'win32', env, os.tmpdir(), alias));

        assert.deepStrictEqual(await executeAzureCli(context, ['account', 'show']), { code: 0, stdout: 'ok', stderr: '' });
        sinon.assert.calledOnceWithExactly(execute, {
            executable,
            args: ['account', 'show'],
            argv0: alias,
            cwd: os.tmpdir(),
            env,
        }, undefined, sinon.match.func);
    });

    test('uses the inherited working directory for validation and execution', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const alias = systemExecutable();
        const env = { PATH: path.dirname(alias) };
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: 'ok', stderr: '' });
        const context = fakeContext(fakeShell(process.platform === 'win32', env, undefined, alias));

        assert.deepStrictEqual(await executeAzureCli(context, ['account', 'show']), { code: 0, stdout: 'ok', stderr: '' });
        assert.strictEqual(execute.firstCall.args[0].cwd, process.cwd());
    });

    test('rejects a native Azure CLI executable resolved from the execution directory', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'azure-workspace-'));
        const bin = path.join(directory, 'bin');
        const alias = path.join(bin, process.platform === 'win32' ? 'az.exe' : 'az');
        nativeFs.mkdirSync(bin);
        nativeFs.symlinkSync(systemExecutable(), alias, 'file');
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const execute = sandbox.stub(processApi, 'executeCommand');
        const context = fakeContext(fakeShell(process.platform === 'win32', { PATH: bin }, directory, alias));

        try {
            assert.strictEqual(await executeAzureCli(context, ['account', 'show']), undefined);
            sinon.assert.notCalled(execute);
        } finally {
            nativeFs.rmSync(directory, { recursive: true, force: true });
        }
    });

    test('rejects a native Azure CLI executable from the inherited execution directory', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const directory = nativeFs.mkdtempSync(path.join(process.cwd(), '.azure-cwd-'));
        const bin = path.join(directory, 'bin');
        const alias = path.join(bin, process.platform === 'win32' ? 'az.exe' : 'az');
        nativeFs.mkdirSync(bin);
        nativeFs.copyFileSync(systemExecutable(), alias);
        const execute = sandbox.stub(processApi, 'executeCommand');
        const context = fakeContext(fakeShell(process.platform === 'win32', { PATH: bin }, undefined, alias));

        try {
            assert.strictEqual(await executeAzureCli(context, ['account', 'show']), undefined);
            sinon.assert.notCalled(execute);
        } finally {
            nativeFs.rmSync(directory, { recursive: true, force: true });
        }
    });

    test('rejects a native Azure CLI alias inside another workspace root', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'azure-workspace-'));
        const bin = path.join(directory, 'bin');
        const alias = path.join(bin, process.platform === 'win32' ? 'az.exe' : 'az');
        nativeFs.mkdirSync(bin);
        nativeFs.symlinkSync(systemExecutable(), alias, 'file');
        sandbox.stub(workspace, 'workspaceFolders').value([{ uri: Uri.file(directory), name: 'workspace', index: 0 }]);
        const execute = sandbox.stub(processApi, 'executeCommand');
        const context = fakeContext(fakeShell(process.platform === 'win32', { PATH: bin }, os.tmpdir(), alias));

        try {
            assert.strictEqual(await executeAzureCli(context, ['account', 'show']), undefined);
            sinon.assert.notCalled(execute);
        } finally {
            nativeFs.rmSync(directory, { recursive: true, force: true });
        }
    });

    test('runs Windows az.cmd through its bundled isolated Python', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'azure-cli-'));
        const bin = path.join(directory, 'bin');
        const wrapper = path.join(bin, 'az.cmd');
        const python = path.join(directory, 'python.exe');
        nativeFs.mkdirSync(bin);
        nativeFs.writeFileSync(wrapper, '@echo off\nSET AZ_INSTALLER=MSI\n');
        nativeFs.writeFileSync(python, 'python');
        const env = { PATH: bin };
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: 'ok', stderr: '' });
        const context = fakeContext(fakeShell(true, env, process.cwd(), wrapper));

        try {
            await executeAzureCli(context, ['account', 'show', '--name', 'value;$(marker)']);
            sinon.assert.calledOnceWithExactly(execute, {
                executable: nativeFs.realpathSync.native(python),
                args: ['-IBm', 'azure.cli', 'account', 'show', '--name', 'value;$(marker)'],
                cwd: process.cwd(),
                env: { ...env, AZ_INSTALLER: 'MSI' },
            }, undefined, sinon.match.func);
        } finally {
            nativeFs.rmSync(directory, { recursive: true, force: true });
        }
    });

    test('resolves the native Azure CLI executable before each launch', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const alias = systemExecutable();
        const shell = fakeShell(process.platform === 'win32', { PATH: path.dirname(alias) }, os.tmpdir());
        sandbox.stub(shell, 'which').onFirstCall().returns(alias).onSecondCall().returns(null);
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: 'ok', stderr: '' });
        const context = fakeContext(shell);

        assert.deepStrictEqual(await executeAzureCli(context, ['account', 'show']), { code: 0, stdout: 'ok', stderr: '' });
        assert.strictEqual(await executeAzureCli(context, ['account', 'show']), undefined);
        sinon.assert.calledOnce(execute);
    });

    test('executes the validated WSL Azure CLI target instead of its alias', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const env = windowsEnvironment();
        const execute = sandbox.stub(processApi, 'executeCommand').callsFake(async (invocation) => {
            const args = invocation.args;
            if (args[1] === '/usr/bin/which') { return { code: 0, stdout: '/usr/local/bin/az\n', stderr: '' }; }
            if (args[1] === '/usr/bin/test') { return { code: 0, stdout: '', stderr: '' }; }
            if (args[1] === '/usr/bin/readlink' && args[3] === '/usr/local/bin/az') {
                return { code: 0, stdout: '/opt/azure-cli/bin/az\n', stderr: '' };
            }
            if (args[1] === '/usr/bin/readlink' && args[3] === '/usr/local/bin') {
                return { code: 0, stdout: '/usr/local/bin\n', stderr: '' };
            }
            if (args[1] === '/usr/bin/readlink') { return { code: 0, stdout: `${args[3]}\n`, stderr: '' }; }
            return { code: 0, stdout: 'ok', stderr: '' };
        });
        const context = fakeContext(fakeShell(false, env, '/workspace'));

        assert.deepStrictEqual(await executeAzureCli(context, ['account', 'show']), { code: 0, stdout: 'ok', stderr: '' });
        sinon.assert.calledWithExactly(execute.lastCall, {
            executable: 'C:\\Windows\\System32\\wsl.exe',
            args: ['--exec', '/opt/azure-cli/bin/az', 'account', 'show'],
            cwd: '/workspace',
            env,
        }, undefined, sinon.match.func);
    });

    test('preserves WSL Snap Azure CLI dispatch without executing its alias', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const execute = sandbox.stub(processApi, 'executeCommand').callsFake(async (invocation) => {
            const args = invocation.args;
            if (args[1] === '/usr/bin/which') { return { code: 0, stdout: '/snap/bin/az\n', stderr: '' }; }
            if (args[1] === '/usr/bin/test') { return { code: 0, stdout: '', stderr: '' }; }
            if (args[1] === '/usr/bin/readlink' && args[2] === '/snap/bin/az') {
                return { code: 0, stdout: '/usr/bin/snap\n', stderr: '' };
            }
            if (args[1] === '/usr/bin/readlink' && args[3] === '/snap/bin/az') {
                return { code: 0, stdout: '/usr/bin/snap\n', stderr: '' };
            }
            if (args[1] === '/usr/bin/readlink' && args[3] === '/snap/bin') {
                return { code: 0, stdout: '/snap/bin\n', stderr: '' };
            }
            if (args[1] === '/usr/bin/readlink' && args[3] === '/usr/bin/snap') {
                return { code: 0, stdout: '/usr/bin/snap\n', stderr: '' };
            }
            if (args[1] === '/usr/bin/readlink') { return { code: 0, stdout: `${args[3]}\n`, stderr: '' }; }
            return { code: 0, stdout: 'ok', stderr: '' };
        });
        const context = fakeContext(fakeShell(false, windowsEnvironment(), '/workspace'));

        assert.deepStrictEqual(await executeAzureCli(context, ['--version']), { code: 0, stdout: 'ok', stderr: '' });
        assert.deepStrictEqual(execute.lastCall.args[0].args, [
            '--exec', '/usr/bin/snap', 'run', '--', 'az', '--version',
        ]);
    });

    test('maps same-distribution WSL UNC workspace roots before containment checks', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const roots = [
            '\\\\wsl$\\Ubuntu\\home\\user\\one',
            '\\\\wsl.localhost\\Ubuntu\\home\\user\\two',
        ];
        sandbox.stub(workspace, 'workspaceFolders').value(roots.map(fakeWorkspaceFolder));
        const mappings = new Map([
            [roots[0], '/home/user/one'],
            [roots[1], '/home/user/two'],
        ]);
        const execute = sandbox.stub(processApi, 'executeCommand').callsFake(async (invocation) => {
            const args = invocation.args;
            if (args[1] === '/usr/bin/which') { return { code: 0, stdout: '/usr/local/bin/az\n', stderr: '' }; }
            if (args[1] === '/usr/bin/test') { return { code: 0, stdout: '', stderr: '' }; }
            if (args[1] === '/usr/bin/wslpath') {
                const converted = mappings.get(args[4]);
                return converted ?
                    { code: 0, stdout: `${converted}\n`, stderr: '' } :
                    { code: 1, stdout: '', stderr: 'different distribution' };
            }
            if (args[1] === '/usr/bin/readlink' && args[3] === '/usr/local/bin/az') {
                return { code: 0, stdout: '/opt/azure-cli/bin/az\n', stderr: '' };
            }
            if (args[1] === '/usr/bin/readlink') { return { code: 0, stdout: `${args[3]}\n`, stderr: '' }; }
            return { code: 0, stdout: 'ok', stderr: '' };
        });
        const context = fakeContext(fakeShell(false, windowsEnvironment(), '/safe/workspace'));

        assert.deepStrictEqual(await executeAzureCli(context, ['account', 'show']), { code: 0, stdout: 'ok', stderr: '' });
        assert.deepStrictEqual(execute.args
            .filter((call) => call[0].args[1] === '/usr/bin/wslpath')
            .map((call) => call[0].args), [
                ['--exec', '/usr/bin/wslpath', '-a', '-u', roots[0]],
                ['--exec', '/usr/bin/wslpath', '-a', '-u', roots[1]],
            ]);
    });

    test('rejects a WSL UNC workspace root from another distribution', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const root = '\\\\wsl$\\Debian\\home\\user\\workspace';
        sandbox.stub(workspace, 'workspaceFolders').value([fakeWorkspaceFolder(root)]);
        const execute = sandbox.stub(processApi, 'executeCommand').callsFake(async (invocation) => {
            const args = invocation.args;
            if (args[1] === '/usr/bin/which') { return { code: 0, stdout: '/usr/local/bin/az\n', stderr: '' }; }
            if (args[1] === '/usr/bin/test') { return { code: 0, stdout: '', stderr: '' }; }
            if (args[1] === '/usr/bin/wslpath') { return { code: 1, stdout: '', stderr: 'different distribution' }; }
            if (args[1] === '/usr/bin/readlink' && args[3] === '/usr/local/bin/az') {
                return { code: 0, stdout: '/opt/azure-cli/bin/az\n', stderr: '' };
            }
            if (args[1] === '/usr/bin/readlink') { return { code: 0, stdout: `${args[3]}\n`, stderr: '' }; }
            return { code: 0, stdout: 'unexpected launch', stderr: '' };
        });
        const context = fakeContext(fakeShell(false, windowsEnvironment(), '/safe/workspace'));

        assert.strictEqual(await executeAzureCli(context, ['account', 'show']), undefined);
        assert.ok(execute.args.some((call) => call[0].args.join('\0') === [
            '--exec', '/usr/bin/wslpath', '-a', '-u', root,
        ].join('\0')));
        assert.ok(!execute.args.some((call) => call[0].args[1] === '/opt/azure-cli/bin/az'));
    });

    test('preserves trailing whitespace when checking a WSL UNC workspace root', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const whitespace = '\u00a0';
        const root = `\\\\wsl$\\Ubuntu\\home\\user\\workspace${whitespace}`;
        const guestRoot = `/home/user/workspace${whitespace}`;
        const alias = `${guestRoot}/bin/az`;
        sandbox.stub(workspace, 'workspaceFolders').value([fakeWorkspaceFolder(root)]);
        const execute = sandbox.stub(processApi, 'executeCommand').callsFake(async (invocation) => {
            const args = invocation.args;
            if (args[1] === '/usr/bin/which') { return { code: 0, stdout: `${alias}\n`, stderr: '' }; }
            if (args[1] === '/usr/bin/test') { return { code: 0, stdout: '', stderr: '' }; }
            if (args[1] === '/usr/bin/wslpath') { return { code: 0, stdout: `${guestRoot}\n`, stderr: '' }; }
            if (args[1] === '/usr/bin/readlink') { return { code: 0, stdout: `${args[3]}\n`, stderr: '' }; }
            return { code: 0, stdout: 'unexpected launch', stderr: '' };
        });
        const context = fakeContext(fakeShell(false, windowsEnvironment(), '/safe/workspace'));

        assert.strictEqual(await executeAzureCli(context, ['account', 'show']), undefined);
        assert.ok(!execute.args.some((call) => call[0].args[1] === alias && call[0].args[2] === 'account'));
    });

    test('pins WSL and rejects guest Azure CLI paths inside the workspace', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const execute = sandbox.stub(processApi, 'executeCommand').callsFake(async (invocation) => {
            const args = invocation.args;
            if (args[1] === '/usr/bin/which') { return { code: 0, stdout: '/workspace/bin/az\n', stderr: '' }; }
            if (args[1] === '/usr/bin/test') { return { code: 0, stdout: '', stderr: '' }; }
            if (args[1] === '/usr/bin/readlink') { return { code: 0, stdout: `${args[3]}\n`, stderr: '' }; }
            return { code: 0, stdout: 'unexpected', stderr: '' };
        });
        const context = fakeContext(fakeShell(false, windowsEnvironment(), '/workspace'));

        assert.strictEqual(await executeAzureCli(context, ['account', 'show']), undefined);
        assert.ok(execute.args.every((call) => call[0].executable === 'C:\\Windows\\System32\\wsl.exe'));
        assert.ok(!execute.args.some((call) => call[0].args[1] === '/workspace/bin/az' && call[0].args[2] === 'account'));
    });

    test('uses fixed WSL utilities for HOME and directory creation', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const execute = sandbox.stub(processApi, 'executeCommand');
        execute.onFirstCall().resolves({ code: 0, stdout: '/home/user\n', stderr: '' });
        execute.onSecondCall().resolves({ code: 0, stdout: '', stderr: '' });
        const context = fakeContext(fakeShell(false, windowsEnvironment(), '/workspace'));

        assert.strictEqual(await azureCliHome(context), '/home/user');
        assert.strictEqual(await ensureAzureCliDirectory(context, '/home/user/bin;$(marker)'), undefined);
        assert.deepStrictEqual(execute.args.map((call) => call[0].args), [
            ['--exec', '/usr/bin/printenv', 'HOME'],
            ['--exec', '/usr/bin/mkdir', '-p', '--', '/home/user/bin;$(marker)'],
        ]);
    });

    test('preserves Azure CLI launch diagnostics', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const alias = systemExecutable();
        sandbox.stub(processApi, 'executeCommand').rejects(new Error('launch failed'));
        const context = fakeContext(fakeShell(
            process.platform === 'win32', { PATH: path.dirname(alias) }, os.tmpdir(), alias
        ));

        assert.deepStrictEqual(await executeAzureCli(context, ['--version']), {
            code: -1, stdout: '', stderr: 'launch failed',
        });
    });

    test('normalizes executable-resolution diagnostics', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const shell = fakeShell(false, { PATH: '/usr/bin' }, '/workspace');
        sandbox.stub(shell, 'execOpts').throws(new Error('environment failed'));

        assert.deepStrictEqual(await executeAzureCli(fakeContext(shell), ['--version']), {
            code: -1, stdout: '', stderr: 'environment failed',
        });
    });
});

function fakeContext(shell: Shell) {
    return { shell, fs: {} as FS };
}

function fakeShell(
    windows: boolean,
    env: NodeJS.ProcessEnv,
    cwd: string | undefined,
    executable?: string
): Shell {
    return {
        isWindows: () => windows,
        isUnix: () => !windows,
        platform: () => windows ? Platform.Windows : Platform.Linux,
        home: () => '/home/user',
        execOpts: () => ({ cwd, env }),
        which: () => executable || null,
    } as unknown as Shell;
}

function fakeWorkspaceFolder(root: string, index = 0): WorkspaceFolder {
    return { uri: { fsPath: root } as Uri, name: `workspace-${index}`, index };
}

function systemExecutable(): string {
    return process.platform === 'win32' ?
        path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'where.exe') :
        '/usr/bin/env';
}

function windowsEnvironment(): NodeJS.ProcessEnv {
    return { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' };
}
