import * as assert from 'assert';
import * as sinon from 'sinon';
import { Shell } from '../../../../src/shell';
import {
    executeHelmCommand,
    helmChartQuery,
    helmCommandInvocation,
    helmDryRunArgs,
    helmFetchArgs,
    helmInspectArgs,
    helmInstallArgs,
    helmPathForExecution,
    helmRepoSearchArgs,
    helmTemplatePreviewArgs,
    HelmSyntaxVersion,
    isSafeHelmChartReference,
    isSafeHelmChartVersion,
    parseHelmChartQuery,
} from '../../../../src/components/helm/commands';

suite('Helm command security', () => {
    const hostilePath = '/work/chart dir/quote";$(marker)&%PATH%!COMSPEC!';

    test('builds local chart commands without empty or combined arguments', () => {
        const windowsTemplatePath = String.raw`templates\pod $(marker).yaml`;
        assert.deepStrictEqual(helmDryRunArgs(HelmSyntaxVersion.V2, hostilePath), [
            'install', '--dry-run', '--debug', hostilePath
        ]);
        assert.deepStrictEqual(helmDryRunArgs(HelmSyntaxVersion.V3, hostilePath), [
            'install', '--dry-run', '--generate-name', '--debug', hostilePath
        ]);
        assert.deepStrictEqual(helmDryRunArgs(HelmSyntaxVersion.V4, hostilePath), [
            'install', '--dry-run=client', '--generate-name', '--debug', hostilePath
        ]);
        assert.deepStrictEqual(
            helmTemplatePreviewArgs(HelmSyntaxVersion.V2, hostilePath, windowsTemplatePath),
            ['template', hostilePath, '--execute', windowsTemplatePath]
        );
        assert.deepStrictEqual(
            helmTemplatePreviewArgs(HelmSyntaxVersion.V3, hostilePath, 'templates/pod $(marker).yaml'),
            ['template', hostilePath, '--show-only', 'templates/pod $(marker).yaml']
        );
    });

    test('builds repository and chart operations as exact arguments', () => {
        const chart = 'repo/chart;$(marker)&value';
        const version = '1.2.3-rc.1+build';

        assert.deepStrictEqual(helmRepoSearchArgs(HelmSyntaxVersion.V2, 'repo;$(marker)'), [
            'search', 'repo;$(marker)/', '-l'
        ]);
        assert.deepStrictEqual(helmRepoSearchArgs(HelmSyntaxVersion.V4, 'repo;$(marker)'), [
            'search', 'repo', 'repo;$(marker)/', '--versions'
        ]);
        assert.deepStrictEqual(helmInspectArgs(HelmSyntaxVersion.V2, 'chart', chart, version), [
            'inspect', chart, '--version', version
        ]);
        assert.deepStrictEqual(helmInspectArgs(HelmSyntaxVersion.V3, 'chart', chart, version), [
            'inspect', 'all', chart, '--version', version
        ]);
        assert.deepStrictEqual(helmInspectArgs(HelmSyntaxVersion.V4, 'values', chart, version), [
            'inspect', 'values', chart, '--version', version
        ]);
        assert.deepStrictEqual(helmFetchArgs(chart, version, hostilePath, true), [
            'fetch', chart, '--untar', '--version', version, '-d', hostilePath
        ]);
        assert.deepStrictEqual(helmInstallArgs(HelmSyntaxVersion.V3, chart, version, 'team-a'), [
            'install', chart, '--version', version, '--namespace', 'team-a', '--generate-name'
        ]);
    });

    test('round-trips bounded chart queries and rejects ambiguous fields', () => {
        const chart = 'repo/chart & value#fragment%25;$(marker)';
        const query = helmChartQuery(chart, '1.2.3');

        assert.deepStrictEqual(parseHelmChartQuery(query), { chart, version: '1.2.3' });
        assert.strictEqual(parseHelmChartQuery('chart=repo%2Fone&chart=repo%2Ftwo&version=1.2.3'), undefined);
        assert.strictEqual(parseHelmChartQuery('chart=repo%2Fchart&version=not-semver'), undefined);
        assert.strictEqual(parseHelmChartQuery(`chart=repo%2Fchart&padding=${'x'.repeat(9000)}`), undefined);
    });

    test('uses field-specific chart and version validation', () => {
        assert.strictEqual(isSafeHelmChartReference('repo/chart;$(marker)&value'), true);
        assert.strictEqual(isSafeHelmChartReference('--help'), false);
        assert.strictEqual(isSafeHelmChartReference('repo/../chart'), false);
        assert.strictEqual(isSafeHelmChartReference('repo/-chart'), false);
        assert.strictEqual(isSafeHelmChartReference('repo\\..\\chart'), false);
        assert.strictEqual(isSafeHelmChartReference('repo//chart'), false);
        assert.strictEqual(isSafeHelmChartReference('repo/chart\nother'), false);
        assert.strictEqual(isSafeHelmChartVersion('1.2.3-rc.1+build'), true);
        assert.strictEqual(isSafeHelmChartVersion('--devel'), false);
    });

    test('constructs native and WSL invocations without rendering shell text', () => {
        const shell = fakeShell(false);
        assert.deepStrictEqual(helmCommandInvocation('/opt/Helm Tools/helm', ['show', 'repo/chart;$(marker)'], shell, false), {
            executable: '/opt/Helm Tools/helm',
            args: ['show', 'repo/chart;$(marker)'],
            cwd: '/workspace path',
            env: { PATH: '/usr/bin' },
        });
        assert.deepStrictEqual(helmCommandInvocation('/opt/Helm Tools/helm', ['show', 'repo/chart;$(marker)'], shell, true), {
            executable: 'wsl.exe',
            args: ['--exec', '/opt/Helm Tools/helm', 'show', 'repo/chart;$(marker)'],
            cwd: '/workspace path',
            env: { PATH: '/usr/bin' },
        });
    });

    test('rejects native Windows command scripts', () => {
        assert.throws(
            () => helmCommandInvocation('C:\\tools\\helm.CMD', ['version'], fakeShell(true), false),
            /configure an \.exe path/
        );
    });

    test('preserves both output streams and exact argv through the executor', async () => {
        const execute = sinon.stub().resolves({ code: 7, stdout: 'partial stdout', stderr: 'helm error' });
        const onSpawn = sinon.stub();

        const result = await executeHelmCommand(
            '/opt/helm',
            ['inspect', 'repo/chart;$(marker)'],
            fakeShell(false),
            false,
            execute,
            onSpawn
        );

        assert.deepStrictEqual(result, { code: 7, stdout: 'partial stdout', stderr: 'helm error' });
        sinon.assert.calledOnceWithExactly(execute, {
            executable: '/opt/helm',
            args: ['inspect', 'repo/chart;$(marker)'],
            cwd: '/workspace path',
            env: { PATH: '/usr/bin' },
        }, undefined, onSpawn);
    });

    test('converts only host paths for WSL execution', async () => {
        const execute = sinon.stub().resolves({ code: 0, stdout: '/mnt/c/work dir/chart\n', stderr: '' });

        assert.strictEqual(await helmPathForExecution('/tmp/chart', true, execute), '/tmp/chart');
        assert.strictEqual(
            await helmPathForExecution('C:\\work dir\\chart', true, execute),
            '/mnt/c/work dir/chart'
        );
        sinon.assert.calledOnceWithExactly(execute, {
            executable: 'wsl.exe',
            args: ['--exec', 'wslpath', '-a', '-u', 'C:\\work dir\\chart'],
        });
    });
});

function fakeShell(windows: boolean): Shell {
    return {
        isWindows: () => windows,
        isUnix: () => !windows,
        platform: () => { throw new Error('not used'); },
        home: () => '',
        combinePath: () => '',
        fileUri: () => { throw new Error('not used'); },
        execOpts: () => ({ cwd: '/workspace path', env: { PATH: '/usr/bin' } }),
        exec: async () => undefined,
        execStreaming: async () => undefined,
        execCore: async () => ({ code: 0, stdout: '', stderr: '' }),
        unquotedPath: (value) => value,
        which: () => null,
        cat: () => '',
        ls: () => [],
    };
}
