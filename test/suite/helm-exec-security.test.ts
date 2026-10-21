import * as assert from 'assert';
import * as vscode from 'vscode';
import { helmExecArgsAsync } from '../../src/helm.exec';

suite('Helm argv execution', () => {
    test('passes hostile values through the production Helm executor', async () => {
        const configuration = vscode.workspace.getConfiguration();
        const key = 'vscode-kubernetes.helm-path';
        const previous = configuration.inspect<string>(key)?.globalValue;
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
        ];

        await configuration.update(key, process.execPath, vscode.ConfigurationTarget.Global);
        try {
            const result = await helmExecArgsAsync([
                '-e',
                'process.stdout.write(JSON.stringify(process.argv.slice(1)));process.stderr.write("stderr preserved")',
                '--',
                ...values,
            ]);

            assert.ok(result);
            assert.strictEqual(result.code, 0);
            assert.deepStrictEqual(JSON.parse(result.stdout), values);
            assert.strictEqual(result.stderr, 'stderr preserved');
        } finally {
            await configuration.update(key, previous, vscode.ConfigurationTarget.Global);
        }
    });
});
