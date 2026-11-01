import * as assert from 'assert';
import * as nativeFs from 'fs';
import * as sinon from 'sinon';
import * as config from '../../../../src/components/config/config';
import { extractTarArchive, makeExecutable } from '../../../../src/components/installer/installer';
import type { Shell } from '../../../../src/shell';

suite('Installer command security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('uses the host filesystem for native executable permissions', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const chmod = sandbox.stub(nativeFs.promises, 'chmod').resolves();
        const execute = sandbox.stub();

        await makeExecutable('/tmp/tool &;$(marker)', fakeShell(), execute);

        sinon.assert.calledOnceWithExactly(chmod, '/tmp/tool &;$(marker)', 0o755);
        sinon.assert.notCalled(execute);
    });

    test('passes a WSL executable path as one chmod argument', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const env = { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' };
        const execute = sandbox.stub().resolves({ code: 0, stdout: '', stderr: '' });

        await makeExecutable('\\home\\user\\tool &;$(marker)', fakeShell(env), execute);

        sinon.assert.calledOnceWithExactly(execute, {
            executable: 'C:\\Windows\\System32\\wsl.exe',
            args: ['--exec', '/usr/bin/chmod', '0755', '--', '/home/user/tool &;$(marker)'],
            cwd: 'C:\\workspace path',
            env,
        });
    });

    test('rejects a host-relative executable path in WSL', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const execute = sandbox.stub();

        await assert.rejects(
            makeExecutable('relative\\tool', fakeShell({ SystemRoot: 'C:\\Windows' }), execute),
            /resolve the installed binary path/
        );
        sinon.assert.notCalled(execute);
    });

    test('extracts a host archive in WSL through exact utility arguments', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const env = { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' };
        const execute = sandbox.stub();
        execute.onCall(0).resolves({ code: 0, stdout: '/mnt/c/Temp/archive & $(marker).tgz\n', stderr: '' });
        execute.onCall(1).resolves({ code: 0, stdout: '', stderr: '' });
        execute.onCall(2).resolves({ code: 0, stdout: '', stderr: '' });

        const result = await extractTarArchive(
            'C:\\Temp\\archive & $(marker).tgz',
            '/home/user/Tools & $(marker)',
            fakeShell(env),
            execute
        );

        assert.deepStrictEqual(result, { succeeded: true, result: null });
        assert.deepStrictEqual(execute.args.map((call) => call[0]), [
            {
                executable: 'C:\\Windows\\System32\\wsl.exe',
                args: ['--exec', '/usr/bin/wslpath', '-a', '-u', 'C:\\Temp\\archive & $(marker).tgz'],
                cwd: 'C:\\workspace path', env,
            },
            {
                executable: 'C:\\Windows\\System32\\wsl.exe',
                args: ['--exec', '/usr/bin/mkdir', '-p', '--', '/home/user/Tools & $(marker)'],
                cwd: 'C:\\workspace path', env,
            },
            {
                executable: 'C:\\Windows\\System32\\wsl.exe',
                args: ['--exec', '/usr/bin/tar', '--directory', '/home/user/Tools & $(marker)', '--extract', '--file', '/mnt/c/Temp/archive & $(marker).tgz'],
                cwd: 'C:\\workspace path', env,
            },
        ]);
    });

    test('stops before extraction when WSL path conversion fails', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        sandbox.stub(console, 'log');
        const execute = sandbox.stub().resolves({ code: 1, stdout: '', stderr: 'conversion failed' });

        const result = await extractTarArchive(
            'C:\\Temp\\archive.tgz',
            '/home/user/tools',
            fakeShell({ SystemRoot: 'C:\\Windows' }),
            execute
        );

        assert.deepStrictEqual(result, { succeeded: false, error: ['tar extract failed'] });
        sinon.assert.calledOnce(execute);
    });
});

function fakeShell(env: NodeJS.ProcessEnv = process.env): Shell {
    return {
        execOpts: () => ({ cwd: 'C:\\workspace path', env }),
    } as unknown as Shell;
}
