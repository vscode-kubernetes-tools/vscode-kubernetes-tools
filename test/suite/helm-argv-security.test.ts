import * as assert from 'assert';
import { executeHelmArgsForTesting } from '../../src/helm.exec';

suite('Helm argv security', () => {
    test('keeps chart, version, namespace, and metacharacters as exact arguments', async () => {
        const values = [
            'install',
            'repo/chart; marker',
            '--version',
            '1.2.3 && marker',
            '--namespace',
            '%PATH% $(marker)',
        ];
        const script = 'process.stdout.write(JSON.stringify(process.argv.slice(1)))';

        const result = await executeHelmArgsForTesting(
            process.execPath,
            ['-e', script, '--', ...values]
        );

        assert.strictEqual(result.code, 0);
        assert.deepStrictEqual(JSON.parse(result.stdout), values);
    });
});
