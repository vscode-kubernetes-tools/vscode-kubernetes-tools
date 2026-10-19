import * as assert from 'assert';
import { parseCommandLine } from '../../../src/utils/command-line';

suite('Legacy command-line parser', () => {
    test('preserves quoted arguments', () => {
        const result = parseCommandLine('get pods --selector "app=my app" --context \'context name\'');
        assert.deepStrictEqual(result, {
            succeeded: true,
            args: ['get', 'pods', '--selector', 'app=my app', '--context', 'context name'],
        });
    });

    for (const operator of [';', '&', '&&', '|', '||', '>', '<', '`', '\n', '\r']) {
        test(`rejects shell syntax ${JSON.stringify(operator)}`, () => {
            const result = parseCommandLine(`get pods ${operator} marker`);
            assert.strictEqual(result.succeeded, false);
        });
    }

    test('keeps command substitution text as data', () => {
        const result = parseCommandLine('get "pod/$(marker)"');
        assert.deepStrictEqual(result, { succeeded: true, args: ['get', 'pod/$(marker)'] });
    });
});
