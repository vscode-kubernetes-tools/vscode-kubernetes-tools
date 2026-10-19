import * as assert from 'assert';
import { executeCommand } from '../../src/process';

suite('Process security', () => {
    test('passes hostile values as exact arguments without a shell', async () => {
        const values = [
            'plain value',
            '$(printf substituted)',
            '`printf substituted`',
            '; printf semicolon',
            '&& printf and',
            '| printf pipe',
            '|| printf or',
            '> local-file',
            '< local-file',
            '%PATH%',
            '!COMSPEC!',
            'quote"single\'backslash\\',
            'line\ncarriage\rreturn',
        ];
        const script = 'process.stdout.write(JSON.stringify(process.argv.slice(1)))';
        const result = await executeCommand({
            executable: process.execPath,
            args: ['-e', script, '--', ...values],
        });

        assert.strictEqual(result.code, 0);
        assert.strictEqual(result.stderr, '');
        assert.deepStrictEqual(JSON.parse(result.stdout), values);
    });

    test('preserves an empty argument', async () => {
        const script = 'process.stdout.write(JSON.stringify(process.argv.slice(1)))';
        const result = await executeCommand({
            executable: process.execPath,
            args: ['-e', script, '--', '', 'after-empty'],
        });

        assert.deepStrictEqual(JSON.parse(result.stdout), ['', 'after-empty']);
    });

    test('enforces the output buffer limit', async () => {
        await assert.rejects(
            executeCommand({
                executable: process.execPath,
                args: ['-e', 'process.stdout.write("12345")'],
                maxBufferBytes: 4,
            }),
            /stdout exceeded/
        );
    });

    test('writes stdin without converting it to command text', async () => {
        const result = await executeCommand(
            {
                executable: process.execPath,
                args: ['-e', 'let value = ""; process.stdin.on("data", c => value += c); process.stdin.on("end", () => process.stdout.write(value))'],
            },
            'stdin; $(marker) & %PATH%\n'
        );

        assert.strictEqual(result.code, 0);
        assert.strictEqual(result.stdout, 'stdin; $(marker) & %PATH%\n');
    });
});
