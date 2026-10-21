import * as assert from 'assert';
import { executeCommand, executeCommandPiped, ProcessExecutionError, snapPipeInvocation, spawnCommand } from '../../src/process';
import type { ChildProcess } from 'child_process';
import childProcesses = require('child_process');
import * as sinon from 'sinon';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';

suite('Process security', () => {
    test('passes hostile values as exact arguments without a shell', async () => {
        const values = [
            'plain value',
            '$(printf substituted)',
            '`printf substituted`',
            '; printf semicolon',
            '&& printf and',
            '| printf pipe',
            '> local-file',
            '%PATH%',
            '!COMSPEC!',
            'quote"single\'backslash\\',
            'line\ncarriage\rreturn',
        ];
        const result = await executeCommand({
            executable: process.execPath,
            args: ['-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', '--', ...values],
        });

        assert.strictEqual(result.code, 0);
        assert.strictEqual(result.stderr, '');
        assert.deepStrictEqual(JSON.parse(result.stdout), values);
    });

    test('passes stdin as data', async () => {
        const input = 'stdin; $(marker) & %PATH%\n';
        const result = await executeCommand({
            executable: process.execPath,
            args: ['-e', 'let value="";process.stdin.on("data",c=>value+=c);process.stdin.on("end",()=>process.stdout.write(value))'],
        }, input);

        assert.strictEqual(result.stdout, input);
    });

    test('preserves an executable alias through argv0', async () => {
        const child = spawnCommand({
            executable: process.execPath,
            argv0: '/external/bin/git',
            args: ['-e', 'process.stdout.write(process.argv0)'],
        });
        const output: Buffer[] = [];
        child.stdout?.on('data', (data: Buffer) => output.push(data));
        await new Promise<void>((resolve, reject) => {
            child.once('error', reject);
            child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`Exited with ${code}`)));
        });

        assert.strictEqual(Buffer.concat(output).toString('utf8'), '/external/bin/git');
    });

    test('does not report a signal-terminated pipeline source as successful', async () => {
        const result = await executeCommandPiped(
            {
                executable: process.execPath,
                args: ['-e', 'process.kill(process.pid, "SIGTERM")'],
            },
            {
                executable: process.execPath,
                args: ['-e', 'process.stdin.pipe(process.stdout)'],
            }
        );

        assert.notStrictEqual(result.code, 0);
    });

    test('keeps the Snap pipeline destination inside WSL', () => {
        assert.deepStrictEqual(snapPipeInvocation({
            executable: 'wsl.exe',
            args: ['--exec', '/usr/bin/kubectl', 'get', 'pods'],
            cwd: '/workspace',
            env: { PATH: '/usr/bin' },
        }, true), {
            executable: 'wsl.exe',
            args: ['--exec', 'cat'],
            cwd: '/workspace',
            env: { PATH: '/usr/bin' },
        });
    });

    test('cancels both pipeline processes and waits for their close events', async () => {
        const controller = new AbortController();
        let source: ChildProcess | undefined;
        let sourceClosed = false;
        const result = executeCommandPiped(
            { executable: process.execPath, args: ['-e', 'process.stdout.write("ready");setInterval(()=>{},1000)'] },
            { executable: process.execPath, args: ['-e', 'process.stdin.pipe(process.stdout)'] },
            undefined,
            (child) => { source = child; child.on('close', () => { sourceClosed = true; }); },
            { signal: controller.signal, onStdout: () => controller.abort() }
        );
        await assert.rejects(result, (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'cancelled');
        assert.ok(source);
        assert.strictEqual(sourceClosed, true);
    });

    test('retains the source exit status when the pipeline destination also fails', async () => {
        const result = await executeCommandPiped(
            { executable: process.execPath, args: ['-e', 'setTimeout(()=>process.exit(7),50)'] },
            { executable: process.execPath, args: ['-e', 'process.exit(3)'] }
        );
        assert.strictEqual(result.code, 7);
    });

    test('cleans up the source if the pipeline destination cannot start', async () => {
        let sourceClosed = false;
        const result = executeCommandPiped(
            { executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] },
            { executable: '/no-such-kubectl-v2/cat', args: [] },
            undefined,
            (child) => child.on('close', () => { sourceClosed = true; })
        );
        await assert.rejects(result, (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'spawn-failed');
        assert.strictEqual(sourceClosed, true);
    });

    test('escalates cancellation when a Unix process ignores SIGTERM', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        const controller = new AbortController();
        let closed = false;
        const result = executeCommand(
            { executable: process.execPath, args: ['-e', 'process.on("SIGTERM",()=>{});process.stdout.write("ready");setInterval(()=>{},1000)'] },
            undefined,
            (child) => child.on('close', () => { closed = true; }),
            { signal: controller.signal, onStdout: () => controller.abort() }
        );
        await assert.rejects(result, (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'cancelled');
        assert.strictEqual(closed, true);
    });

    test('uses normal cleanup when pipeline startup throws synchronously', async () => {
        const sandbox = sinon.createSandbox();
        const child = Object.assign(new EventEmitter(), {
            stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
            exitCode: null, signalCode: null,
            kill: sinon.stub().callsFake((signal?: string) => {
                if (signal === 'SIGKILL') {
                    child.emit('close', null, 'SIGKILL');
                }
                return true;
            }),
        });
        try {
            const spawn = sandbox.stub(childProcesses, 'spawn');
            spawn.onFirstCall().returns(child as unknown as ChildProcess);
            spawn.onSecondCall().throws(Object.assign(new Error('Invalid destination'), { code: 'EINVAL' }));
            const failure = executeCommandPiped(
                { executable: 'kubectl', args: [] }, { executable: 'cat', args: [] }
            ).catch((error: unknown) => error);
            const error = await failure;
            sinon.assert.calledWith(child.kill, 'SIGKILL');
            assert.ok(error instanceof ProcessExecutionError);
            assert.strictEqual(error.reason, 'spawn-failed');
            assert.strictEqual(error.errorCode, 'EINVAL');
        } finally {
            sandbox.restore();
            child.stdin.destroy();
            child.stdout.destroy();
            child.stderr.destroy();
        }
    });
});
