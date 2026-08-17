import * as assert from 'assert';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { patchFilePaths } from '../../src/yaml-support/kustomize-patch-index';

// Mirrors normalisePath in the module under test. Without it the expected values keep the
// drive-letter casing path.resolve produces, while the production code lowercases it, and
// every positive assertion fails on the windows-latest leg of CI.
function normalise(fsPath: string): string {
    return process.platform === 'win32' ? fsPath.toLowerCase() : fsPath;
}

const DIR = normalise(path.resolve(path.sep, 'work', 'overlays', 'local'));

function pathsIn(kustomizationYaml: string): readonly string[] {
    return patchFilePaths(yaml.load(kustomizationYaml), DIR);
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
  - path: ../shared/patch-resources.yaml
`);
            assert.deepStrictEqual([resolved('..', 'shared', 'patch-resources.yaml')], [...paths]);
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
});
