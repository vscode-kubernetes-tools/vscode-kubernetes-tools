import * as assert from 'assert';

suite("foo", () => {
    suite("biscuit method", () => {
        suite("when eating the biscuits", () => {
            test("...it noms them", () => {
                assert.strictEqual(4, 2 + 2);
            });
        });
    });
});
