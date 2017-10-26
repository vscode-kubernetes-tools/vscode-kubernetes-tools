import * as assert from 'assert';

export function startsWith(expected : string, actual : string) {
    if (!actual.startsWith(expected)) {
        assert.fail(actual, `Something that started with '${expected}'`, 'Explanation did not contain expected text', undefined);
    }
}

export function includes(expected : string, actual : string) {
    if (!actual.includes(expected)) {
        assert.fail(actual, `Something that contains '${expected}'`, 'Explanation did not contain expected text', undefined);
    }
}
