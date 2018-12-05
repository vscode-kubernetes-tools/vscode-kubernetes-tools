
import * as assert from 'assert';

import { getEnabledLintersInternal } from '../src/components/config/config';

describe("Config tests", () => {
    it("should disable linting on undefined", () => {
        const result = getEnabledLintersInternal(undefined, "some, linter, here");
        assert.equal([], result);
    });
    it("should disable linting on disable = true", () => {
        const result = getEnabledLintersInternal("true", "some, linter, here");
        assert.equal([], result);
    });
    it("should enable linting on true", () => {
        const result = getEnabledLintersInternal("false", "some, linter, here");
        assert.equal(["some", "linter", "here"], result);
    });
    it("should enable linting on true", () => {
        const result = getEnabledLintersInternal("false", undefined);
        assert.equal(["all"], result);
    });
});