import * as assert from 'assert';
import { executeCommand, executeCommandPiped, snapPipeInvocation, spawnCommand } from '../../src/process';

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
});
