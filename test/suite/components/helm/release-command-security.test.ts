import * as assert from 'assert';
import {
    helmGetArgs,
    helmHistoryArgs,
    helmListArgs,
    helmRollbackArgs,
    helmUninstallArgs,
    HelmSyntaxVersion,
    isSafeHelmReleaseName,
    isSafeHelmRevision,
} from '../../../../src/components/helm/commands';
import { helmCommandInvocation } from '../../../../src/components/helm/executable';
import { Shell } from '../../../../src/shell';

suite('Helm release command security', () => {
    const release = 'release &value#fragment;$(marker)%PATH%!COMSPEC!';

    test('preserves Helm 2 release syntax without unsupported namespace flags', () => {
        assert.deepStrictEqual(helmGetArgs(HelmSyntaxVersion.V2, release, 3, 'team-a'), [
            'get', '--revision', '3', '--', release,
        ]);
        assert.deepStrictEqual(helmHistoryArgs(HelmSyntaxVersion.V2, release, 'team-a'), [
            'history', '--output', 'json', '--', release,
        ]);
        assert.deepStrictEqual(helmRollbackArgs(HelmSyntaxVersion.V2, release, 3, 'team-a'), [
            'rollback', '--cleanup-on-fail', '--', release, '3',
        ]);
        assert.deepStrictEqual(helmUninstallArgs(HelmSyntaxVersion.V2, release, 'team-a'), [
            'del', '--', release,
        ]);
    });

    for (const version of [HelmSyntaxVersion.V3, HelmSyntaxVersion.V4, HelmSyntaxVersion.Unknown]) {
        test(`preserves namespace and revision for modern Helm syntax ${version}`, () => {
            assert.deepStrictEqual(helmGetArgs(version, release, 3, 'team-a'), [
                'get', 'all', '--revision', '3', '--namespace', 'team-a', '--', release,
            ]);
            assert.deepStrictEqual(helmHistoryArgs(version, release, 'team-a'), [
                'history', '--output', 'json', '--namespace', 'team-a', '--', release,
            ]);
            assert.deepStrictEqual(helmRollbackArgs(version, release, 3, 'team-a'), [
                'rollback', '--cleanup-on-fail', '--namespace', 'team-a', '--', release, '3',
            ]);
            assert.deepStrictEqual(helmUninstallArgs(version, release, 'team-a'), [
                'del', '--namespace', 'team-a', '--', release,
            ]);
        });
    }

    test('omits absent options and preserves an explicit zero revision', () => {
        assert.deepStrictEqual(helmGetArgs(HelmSyntaxVersion.V3, 'app'), ['get', 'all', '--', 'app']);
        assert.deepStrictEqual(helmGetArgs(HelmSyntaxVersion.V2, 'values', 0), [
            'get', '--revision', '0', '--', 'values',
        ]);
        assert.deepStrictEqual(helmRollbackArgs(HelmSyntaxVersion.V3, 'app', 0), [
            'rollback', '--cleanup-on-fail', '--', 'app', '0',
        ]);
        assert.deepStrictEqual(helmHistoryArgs(HelmSyntaxVersion.V3, 'app'), ['history', '--output', 'json', '--', 'app']);
        assert.deepStrictEqual(helmUninstallArgs(HelmSyntaxVersion.V3, 'app'), ['del', '--', 'app']);
    });

    test('keeps namespace and paging cursor in separate list arguments', () => {
        assert.deepStrictEqual(helmListArgs('team-a', release), [
            'list', '--max', '0', '--output', 'json', '--namespace', 'team-a', '--offset', release,
        ]);
        assert.deepStrictEqual(helmListArgs(undefined, '0'), ['list', '--max', '0', '--output', 'json', '--offset', '0']);
        assert.deepStrictEqual(helmListArgs(), ['list', '--max', '0', '--output', 'json']);
        assert.deepStrictEqual(helmListArgs(''), ['list', '--max', '0', '--output', 'json']);
    });

    test('preserves release arguments and a configured Windows executable path', () => {
        const args = helmRollbackArgs(HelmSyntaxVersion.V3, release, 3, 'team-a');
        const invocation = helmCommandInvocation({ path: 'C:\\Helm Tools\\helm.exe' }, args, windowsShell(), false);

        assert.strictEqual(invocation.executable, 'C:\\Helm Tools\\helm.exe');
        assert.deepStrictEqual(invocation.args, args);
    });

    test('preserves release arguments across the WSL executable boundary', () => {
        const args = helmGetArgs(HelmSyntaxVersion.V3, release, 3, 'team-a');
        const invocation = helmCommandInvocation({ path: '/opt/Helm Tools/helm' }, args, windowsShell(), true);

        assert.strictEqual(invocation.executable, 'C:\\Windows\\System32\\wsl.exe');
        assert.deepStrictEqual(invocation.args, ['--exec', '/opt/Helm Tools/helm', ...args]);
    });

    test('rejects option-like names and control characters without relying on shell escaping', () => {
        assert.strictEqual(isSafeHelmReleaseName(release), true);
        assert.strictEqual(isSafeHelmReleaseName('a'.repeat(53)), true);
        for (const value of ['', '--help', '-a', ' app', 'app ', 'app\nother', 'app\rname', 'app\0name', 'app\x1bname', 'a'.repeat(254), null, 3]) {
            assert.strictEqual(isSafeHelmReleaseName(value), false, JSON.stringify(value));
        }
    });

    test('accepts only non-negative safe integer revisions', () => {
        for (const value of [0, 1, 123, Number.MAX_SAFE_INTEGER]) {
            assert.strictEqual(isSafeHelmRevision(value), true);
        }
        for (const value of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', '1;$(marker)', undefined, null]) {
            assert.strictEqual(isSafeHelmRevision(value), false, String(value));
        }
    });
});

function windowsShell(): Shell {
    return {
        isWindows: () => true,
        execOpts: () => ({ cwd: 'C:\\workspace', env: { SystemRoot: 'C:\\Windows' } }),
    } as Shell;
}
