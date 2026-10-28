import * as assert from 'assert';
import * as nativeFs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as config from '../../src/components/config/config';
import { checkForBinary, findBinaryPath, wslBinaryPathExists } from '../../src/binutil';
import { Context, findBinary, invokeForResult, invokeForResultArgs } from '../../src/binutilplusplus';
import * as processApi from '../../src/process';
import type { FS } from '../../src/fs';
import type { Host } from '../../src/host';
import type { Shell } from '../../src/shell';

suite('Binary discovery security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('resolves a native executable from PATH without interpreting its directory', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const fixture = executableFixture('kubectl');
        try {
            const shell = fakeShell(process.platform === 'win32', { PATH: fixture.bin });
            assert.strictEqual(await findBinaryPath(shell, 'kubectl'), fixture.executable);

            const legacy = {
                host: {} as Host,
                fs: {} as FS,
                shell,
                binFound: false,
                binPath: 'kubectl',
            };
            assert.strictEqual(await checkForBinary(legacy, undefined, 'kubectl', '', '', false), true);
            assert.strictEqual(legacy.binPath, fixture.executable);

            sandbox.stub(config, 'getToolPath').returns(undefined);
            const context: Context = {
                host: {} as Host,
                fs: {} as FS,
                shell,
                pathfinder: undefined,
                binary: { binBaseName: 'kubectl', configKeyName: 'kubectl', displayName: 'Kubectl', offersInstall: true },
                status: undefined,
            };
            assert.deepStrictEqual(await findBinary(context), {
                found: true,
                how: 'path',
                where: fixture.executable,
            });

            const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: 'ok', stderr: '' });
            assert.strictEqual((await invokeForResultArgs(context, ['version'], undefined)).resultKind, 'exec-succeeded');
            sinon.assert.calledOnceWithExactly(execute, {
                executable: fixture.executable,
                args: ['version'],
                cwd: '/workspace',
                env: { PATH: fixture.bin },
            }, undefined, sinon.match.func);

            const legacyExec = sandbox.stub().resolves({ code: 0, stdout: 'legacy', stderr: '' });
            const legacyContext = { ...context, shell: { ...shell, exec: legacyExec } as unknown as Shell };
            await invokeForResult(legacyContext, 'version', undefined);
            sinon.assert.calledOnceWithExactly(legacyExec, 'kubectl version', undefined);
        } finally {
            fixture.remove();
        }
    });

    test('discovers a WSL executable with a fixed script and literal tool name', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const env = { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' };
        const shell = fakeShell(false, env, 'C:\\workspace path');
        const execute = sandbox.stub().resolves({ code: 0, stdout: '/usr/local/bin/tool&literal\n', stderr: '' });

        assert.strictEqual(await findBinaryPath(shell, 'tool-literal', execute), '/usr/local/bin/tool&literal');
        sinon.assert.calledOnceWithExactly(execute, {
            executable: 'C:\\Windows\\System32\\wsl.exe',
            args: [
                '--exec', '/bin/sh', '-c',
                'exec /usr/bin/env VSCODE_KUBERNETES_TOOL="$1" "${SHELL:-/bin/sh}" -c \'which -- "$VSCODE_KUBERNETES_TOOL"\'',
                'vscode-kubernetes-which', 'tool-literal',
            ],
            cwd: 'C:\\workspace path',
            env,
        });
    });

    test('rejects command text and ambiguous WSL discovery output', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const shell = fakeShell(false, { SystemRoot: 'C:\\Windows' });
        const execute = sandbox.stub().resolves({ code: 0, stdout: '/usr/bin/tool\n/workspace/tool\n', stderr: '' });

        assert.strictEqual(await findBinaryPath(shell, 'tool;$(marker)', execute), undefined);
        sinon.assert.notCalled(execute);
        assert.strictEqual(await findBinaryPath(shell, 'tool', execute), undefined);
        sinon.assert.calledOnce(execute);
    });

    test('checks a configured WSL path as one argument', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const env = { SystemRoot: 'C:\\Windows' };
        const shell = fakeShell(false, env, 'C:\\workspace');
        const execute = sandbox.stub().resolves({ code: 0, stdout: '', stderr: '' });
        const configured = '/home/user/tool &;$(marker) %PATH% !x!';

        assert.strictEqual(await wslBinaryPathExists(shell, configured, execute), true);
        sinon.assert.calledOnceWithExactly(execute, {
            executable: 'C:\\Windows\\System32\\wsl.exe',
            args: ['--exec', '/usr/bin/test', '-e', configured],
            cwd: 'C:\\workspace',
            env,
        });
    });
});

function fakeShell(windows: boolean, env: NodeJS.ProcessEnv, cwd = '/workspace'): Shell {
    return {
        isWindows: () => windows,
        execOpts: () => ({ cwd, env }),
    } as unknown as Shell;
}

function executableFixture(name: string) {
    const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'binary-discovery-'));
    const bin = path.join(directory, 'bin & $(marker)');
    nativeFs.mkdirSync(bin);
    const executable = path.join(bin, process.platform === 'win32' ? `${name}.exe` : name);
    nativeFs.writeFileSync(executable, process.platform === 'win32' ? '' : '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    return {
        bin,
        executable,
        remove: () => nativeFs.rmSync(directory, { recursive: true, force: true }),
    };
}
