import * as assert from 'assert';
import * as cacheinfo from '../../../../src/components/clusterprovider/common/cacheinfo';

suite("Cache Date", () => {
    suite("is valid date method", () => {
        suite("when supplied various date format", () => {

            test("...it validates ISO 8601 format with timezone", () => {
                const date = "2022-11-01T03:49:40.110Z";
                assert.strictEqual(cacheinfo.isValidDate(date), true);
            });

            test("...it validates ISO 8601 format without time", () => {
                const date = "2022-11-01";
                assert.strictEqual(cacheinfo.isValidDate(date), true);
            });

            test("...it validates ISO 8601 format with time offset", () => {
                const date = "2022-11-01T12:00:00+05:30";
                assert.strictEqual(cacheinfo.isValidDate(date), true);
            });

            test("...it validates RFC 2822 format", () => {
                const date = "Thu, 03 Nov 2022 05:20:19 +0000";
                assert.strictEqual(cacheinfo.isValidDate(date), true);
            });

            test("...it rejects random string", () => {
                const date = "foo";
                assert.strictEqual(cacheinfo.isValidDate(date), false);
            });

            test("...it rejects numeric string", () => {
                const date = "879879879879";
                assert.strictEqual(cacheinfo.isValidDate(date), false);
            });

        });
    });
});
