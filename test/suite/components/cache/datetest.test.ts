import * as assert from 'assert';
import * as cacheinfo from '../../../../src/components/clusterprovider/common/cacheinfo';

suite("Cache Date", () => {
    suite("is valid date method", () => {
        suite("when supplied various date format", () => {

            test("...it validates correct format", () => {
                const date = "2022-11-01T03:49:40.110Z";
                assert.strictEqual(cacheinfo.isValidDate(date), true);
            });

            test("...it validates correct format", () => {
                const date = "2022-11-1";
                assert.strictEqual(cacheinfo.isValidDate(date), true);

            });

            test("...it validates correct format", () => {
                const date = "11/1/2022";
                assert.strictEqual(cacheinfo.isValidDate(date), true);

            });

            test("...it validates correct format", () => {
                const date = "Thu Nov 03 2022 05:20:19";
                assert.strictEqual(cacheinfo.isValidDate(date), true);

            });

            test("...it validates incorrect format", () => {
                const date = "foo";
                assert.strictEqual(cacheinfo.isValidDate(date), false);

            });

            test("...it validates incorrect them", () => {
                const date = "879879879879";
                cacheinfo.isValidDate(date);
                assert.strictEqual(cacheinfo.isValidDate(date), false);
            });

        });
    });
});
