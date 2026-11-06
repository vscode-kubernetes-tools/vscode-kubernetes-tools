import * as assert from 'assert';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { isAtOrUnder, parseKustomization, patchFilePaths } from '../../src/yaml-support/kustomize-patch-index';

// Mirrors normalisePath in the module under test. Without it the expected values keep the
// drive-letter casing path.resolve produces, while the production code lowercases it, and
// every positive assertion fails on the windows-latest leg of CI.
function normalise(fsPath: string): string {
    return process.platform === 'win32' ? fsPath.toLowerCase() : fsPath;
}

const DIR = normalise(path.resolve(path.sep, 'work', 'overlays', 'local'));

function pathsIn(kustomizationYaml: string): readonly string[] {
    return patchFilePaths(parseKustomization(kustomizationYaml), DIR);
}

function resolved(...segments: string[]): string {
    return normalise(path.resolve(DIR, ...segments));
}

suite("Kustomize patch index", () => {
    suite("patchFilePaths method", () => {

        test("...finds paths under patches", () => {
            const paths = pathsIn(`
patches:
  - path: patch-deployment.yaml
    target:
      kind: Deployment
`);
            assert.deepStrictEqual([resolved('patch-deployment.yaml')], [...paths]);
        });

        test("...finds paths under the deprecated patchesStrategicMerge", () => {
            const paths = pathsIn(`
patchesStrategicMerge:
  - patch-gateway.yaml
  - patch-admin.yaml
`);
            assert.deepStrictEqual([resolved('patch-gateway.yaml'), resolved('patch-admin.yaml')], [...paths]);
        });

        test("...finds paths under the deprecated patchesJson6902", () => {
            const paths = pathsIn(`
patchesJson6902:
  - path: replica-count.yaml
    target:
      kind: Deployment
      name: server
`);
            assert.deepStrictEqual([resolved('replica-count.yaml')], [...paths]);
        });

        test("...resolves relative to the kustomization directory", () => {
            const paths = pathsIn(`
patches:
  - path: components/patch-resources.yaml
`);
            assert.deepStrictEqual([resolved('components', 'patch-resources.yaml')], [...paths]);
        });

        test("...ignores resources, which are complete objects", () => {
            const paths = pathsIn(`
resources:
  - deployment.yaml
  - service.yaml
`);
            assert.deepStrictEqual([], [...paths]);
        });

        test("...ignores inline patches, which name no file", () => {
            const paths = pathsIn(`
patches:
  - patch: |-
      - op: replace
        path: /spec/replicas
        value: 2
    target:
      kind: Deployment
`);
            assert.deepStrictEqual([], [...paths]);
        });

        test("...ignores inline patchesStrategicMerge entries", () => {
            const paths = pathsIn(`
patchesStrategicMerge:
  - |-
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: server
    spec:
      replicas: 2
`);
            assert.deepStrictEqual([], [...paths]);
        });

        test("...ignores remote references", () => {
            const paths = pathsIn(`
patches:
  - path: https://example.com/patch.yaml
  - path: git@github.com:someone/repo.git
  - path: github.com/someone/repo/patch.yaml
patchesStrategicMerge:
  - https://example.com/other.yaml
`);
            assert.deepStrictEqual([], [...paths]);
        });

        test("...collects from every patch field at once", () => {
            const paths = pathsIn(`
resources:
  - ../../base
patches:
  - path: a.yaml
patchesJson6902:
  - path: b.yaml
    target:
      kind: Service
patchesStrategicMerge:
  - c.yaml
`);
            assert.deepStrictEqual([resolved('a.yaml'), resolved('b.yaml'), resolved('c.yaml')], [...paths]);
        });

        test("...tolerates an empty document", () => {
            assert.deepStrictEqual([], [...patchFilePaths(yaml.load(''), DIR)]);
        });

        test("...tolerates patch fields of the wrong shape", () => {
            const paths = pathsIn(`
patches: not-a-list
patchesStrategicMerge:
  - 42
  - null
patchesJson6902:
  - target:
      kind: Deployment
`);
            assert.deepStrictEqual([], [...paths]);
        });

    });

    // Kustomize loads patches under LoadRestrictionsRootOnly by default and rejects a
    // target outside the kustomization's own directory. The index has to match that: it is
    // a suppression set, so a target that escapes would let one kustomization turn off
    // schema and lint diagnostics for an unrelated open document, including one in another
    // workspace folder, since the set is global.
    suite("load restrictions", () => {

        test("...ignores a patch that walks out of the kustomization directory", () => {
            assert.deepStrictEqual([], [...pathsIn('patches:\n  - path: ../shared/patch.yaml\n')]);
        });

        test("...ignores an absolute patch path", () => {
            const outside = path.resolve(path.sep, 'elsewhere', 'patch.yaml');
            assert.deepStrictEqual([], [...pathsIn(`patches:\n  - path: ${outside}\n`)]);
        });

        test("...ignores a deprecated patchesStrategicMerge entry that walks out", () => {
            assert.deepStrictEqual([], [...pathsIn('patchesStrategicMerge:\n  - ../../far/patch.yaml\n')]);
        });

        test("...ignores a sibling directory sharing a name prefix", () => {
            assert.deepStrictEqual([], [...pathsIn('patches:\n  - path: ../local-2/patch.yaml\n')]);
        });

        test("...keeps a patch nested below the kustomization directory", () => {
            const paths = pathsIn('patches:\n  - path: nested/deeper/patch.yaml\n');
            assert.deepStrictEqual([resolved('nested', 'deeper', 'patch.yaml')], [...paths]);
        });

        test("...keeps a patch that walks out and back into the same directory", () => {
            assert.deepStrictEqual([resolved('patch.yaml')], [...pathsIn('patches:\n  - path: ../local/patch.yaml\n')]);
        });

    });

    // The index reads files nobody opened, so a crafted kustomization must not be able to
    // stall activation or inflate a small input into a large retained set.
    suite("extraction limits", () => {

        test("...deduplicates a path named more than once", () => {
            const paths = pathsIn(`
patches:
  - path: patch.yaml
  - path: patch.yaml
patchesStrategicMerge:
  - patch.yaml
`);
            assert.deepStrictEqual([resolved('patch.yaml')], [...paths]);
        });

        test("...caps the number of entries it retains", () => {
            const entries = Array.from({ length: 5000 }, (_, i) => `  - path: patch-${i}.yaml`).join('\n');
            const paths = pathsIn(`patches:\n${entries}\n`);
            assert.strictEqual(2048, paths.length);
        });

        test("...ignores an entry longer than the path limit", () => {
            const paths = pathsIn(`patches:\n  - path: ${'a'.repeat(5000)}.yaml\n`);
            assert.deepStrictEqual([], [...paths]);
        });

        test("...ignores an entry whose resolved path exceeds the limit", () => {
            const deep = Array.from({ length: 300 }, () => 'nested-directory-name').join('/');
            const paths = pathsIn(`patches:\n  - path: ${deep}/patch.yaml\n`);
            assert.deepStrictEqual([], [...paths]);
        });

    });

    // The index parses workspace files nobody opened, so the schema it uses is a security
    // boundary, not a detail. CORE_SCHEMA carries neither merge keys nor !!omap, both of
    // which have been the subject of CPU-exhaustion advisories against js-yaml.
    suite("parseKustomization method", () => {

        test("...does not expand merge keys", () => {
            const parsed = parseKustomization(`
base: &base
  path: from-the-anchor.yaml
patches:
  - <<: *base
`) as { patches: Array<Record<string, unknown>> };
            // With merge semantics this entry would gain a `path`. Without them the key
            // stays literal, so nothing is indexed.
            assert.strictEqual(undefined, parsed.patches[0].path);
            assert.deepStrictEqual([], [...patchFilePaths(parsed, DIR)]);
        });

        test("...still reads a plain kustomization", () => {
            const parsed = parseKustomization('patches:\n  - path: patch.yaml\n') as Record<string, unknown>;
            assert.deepStrictEqual([resolved('patch.yaml')], [...patchFilePaths(parsed, DIR)]);
        });

    });

    // Decides whether a deleted or renamed directory reaches a kustomization we hold, and
    // so whether to reconcile. Getting it wrong by a string prefix would rescan on
    // unrelated siblings, or -- worse -- miss the directory that actually went.
    suite("isAtOrUnder method", () => {

        const container = path.resolve(path.sep, 'work', 'overlays');

        test("...a path is under itself", () => {
            assert.strictEqual(true, isAtOrUnder(container, container));
        });

        test("...a file directly inside is under it", () => {
            assert.strictEqual(true, isAtOrUnder(path.join(container, 'kustomization.yaml'), container));
        });

        test("...a file further down is under it", () => {
            assert.strictEqual(true, isAtOrUnder(path.join(container, 'local', 'kustomization.yaml'), container));
        });

        test("...a sibling sharing a name prefix is not under it", () => {
            assert.strictEqual(false, isAtOrUnder(path.join(`${container}-2`, 'kustomization.yaml'), container));
        });

        test("...a sibling whose name merely starts the same is not under it", () => {
            assert.strictEqual(false, isAtOrUnder(`${container}.bak`, container));
        });

        test("...the parent is not under it", () => {
            assert.strictEqual(false, isAtOrUnder(path.dirname(container), container));
        });

        test("...an unrelated path is not under it", () => {
            assert.strictEqual(false, isAtOrUnder(path.resolve(path.sep, 'elsewhere', 'kustomization.yaml'), container));
        });

        test("...a trailing separator on the container makes no difference", () => {
            assert.strictEqual(true, isAtOrUnder(path.join(container, 'kustomization.yaml'), container + path.sep));
        });

    });
});
