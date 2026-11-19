import * as assert from 'assert';
import { formatComplex } from '../../src/schema-formatting';

suite('Schema formatting', () => {
    test('formatComplex documents properties that have a description', () => {
        const result = formatComplex('spec', 'The spec.', undefined, {
            replicas: { type: 'integer', description: 'Number of replicas.' },
        });

        assert.strictEqual(result, 'spec: The spec.\n\n**replicas** (integer)\n\nNumber of replicas.\n\n');
    });

    test('formatComplex does not print "undefined" for a property without a description', () => {
        // Properties without a description are common in CRD schemas.
        const result = formatComplex('spec', 'The spec.', undefined, {
            replicas: { type: 'integer' },
            paused: { type: 'boolean', description: 'Whether the rollout is paused.' },
        });

        assert.strictEqual(result, 'spec: The spec.\n\n**paused** (boolean)\n\nWhether the rollout is paused.\n\n**replicas** (integer)\n\n\n\n');
    });
});
