import * as assert from 'assert';
import { executeCommand, executeCommandPiped, ProcessExecutionError, snapPipeInvocation, spawnCommand } from '../../src/process';

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
            executable: 'C:\\Windows\\System32\\wsl.exe',
            args: ['--exec', '/usr/bin/kubectl', 'get', 'pods'],
            cwd: '/workspace',
            env: { PATH: '/usr/bin' },
        }, true, 'C:\\Windows\\System32\\wsl.exe'), {
            executable: 'C:\\Windows\\System32\\wsl.exe',
            args: ['--exec', 'cat'],
            cwd: '/workspace',
            env: { PATH: '/usr/bin' },
        });
    });

    test('cancels both pipeline processes and waits for close events', async () => {
        const controller = new AbortController();
        let sourceClosed = false;
        const result = executeCommandPiped(
            { executable: process.execPath, args: ['-e', 'process.stdout.write("ready");setInterval(()=>{},1000)'] },
            { executable: process.execPath, args: ['-e', 'process.stdin.pipe(process.stdout)'] },
            undefined,
            (child) => child.on('close', () => { sourceClosed = true; }),
            { signal: controller.signal, onStdout: () => controller.abort() }
        );

        await assert.rejects(result, (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'cancelled');
        assert.strictEqual(sourceClosed, true);
    });

    test('retains the source exit status when the pipeline destination also fails', async () => {
        const result = await executeCommandPiped(
            { executable: process.execPath, args: ['-e', 'process.exit(7)'] },
            { executable: process.execPath, args: ['-e', 'process.stdin.resume();process.stdin.on("end",()=>process.exit(3))'] }
        );
        assert.strictEqual(result.code, 7);
    });

    test('cleans up the source if the pipeline destination cannot start', async () => {
        let sourceClosed = false;
        const result = executeCommandPiped(
            { executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] },
            { executable: '/no-such-kubernetes-client-pilot/cat', args: [] },
            undefined,
            (child) => child.on('close', () => { sourceClosed = true; })
        );

        await assert.rejects(result, (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'spawn-failed');
        assert.strictEqual(sourceClosed, true);
    });

    test('escalates cancellation when a Unix process ignores SIGTERM', async function () {
        if (process.platform === 'win32') { this.skip(); }
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

    test('waits for cleanup after the buffered output limit is exceeded', async () => {
        let closed = false;
        const result = executeCommand(
            { executable: process.execPath, args: ['-e', 'process.stdout.write("x".repeat(2048));setInterval(()=>{},1000)'] },
            undefined,
            (child) => child.on('close', () => { closed = true; }),
            { maxBufferBytes: 1024 }
        );

        await assert.rejects(result, (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'output-limit');
        assert.strictEqual(closed, true);
    });

    test('preserves the shared output budget for a pipeline', async () => {
        const result = executeCommandPiped(
            { executable: process.execPath, args: ['-e', 'process.stdout.write("x".repeat(600));process.stderr.write("y".repeat(600))'] },
            { executable: process.execPath, args: ['-e', 'process.stdin.pipe(process.stdout)'] },
            undefined, undefined, { maxBufferBytes: 1024 }
        );

        await assert.rejects(result, (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'output-limit');
    });
});
