import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { Shell } from '../../../../src/shell';
import {
    helmChartQuery,
    helmDryRunArgs,
    helmDependencyListArgs,
    helmFetchArgs,
    helmFetchedChartDirectoryName,
    helmFileQuery,
    helmInspectArgs,
    helmInstallArgs,
    helmRepoSearchArgs,
    helmRepositorySearchPattern,
    helmTemplatePreviewArgs,
    HelmSyntaxVersion,
    isSafeHelmChartReference,
    isSafeHelmChartVersion,
    isExplicitHelmLocalChartReference,
    isSafeHelmRepositoryChartReference,
    isSafeHelmRepositoryChartVersion,
    isSafeHelmRepositoryName,
    parseHelmChartQuery,
    parseHelmFileQuery,
    parseHelmRepositoryChartQuery,
} from '../../../../src/components/helm/commands';
import {
    executeHelmCommand,
    helmCommandInvocation,
    helmPathForExecution,
    helmRepositoryCommandCwd,
    resolveHelmExecutableForExecution,
} from '../../../../src/components/helm/executable';

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
        const repository = 'repo.+(prod)';

        assert.deepStrictEqual(helmRepoSearchArgs(HelmSyntaxVersion.V2, repository), [
            'search', '--regexp', '--versions', '--col-width', '0', '--',
            String.raw`(?i)^[^\v]+\vrepo\.\+\(prod\)/[^\v]+\v`
        ]);
        assert.deepStrictEqual(helmRepoSearchArgs(HelmSyntaxVersion.Unknown, repository), [
            'search', '--regexp', '--versions', '--col-width', '0', '--',
            String.raw`(?i)^[^\v]+\vrepo\.\+\(prod\)/[^\v]+\v`
        ]);
        assert.deepStrictEqual(helmRepoSearchArgs(HelmSyntaxVersion.V4, repository), [
            'search', 'repo', '--regexp', '--versions', '--max-col-width', '0', '--',
            String.raw`^[^\v]+\vrepo\.\+\(prod\)/[^\v]+\v`
        ]);
        assert.strictEqual(
            helmRepositorySearchPattern('stable', false),
            String.raw`^[^\v]+\vstable/[^\v]+\v`
        );
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
        assert.deepStrictEqual(helmDependencyListArgs(HelmSyntaxVersion.V2, hostilePath), [
            'dep', 'list', hostilePath
        ]);
        assert.deepStrictEqual(helmDependencyListArgs(HelmSyntaxVersion.V3, hostilePath), [
            'dep', 'list', hostilePath
        ]);
        assert.deepStrictEqual(helmDependencyListArgs(HelmSyntaxVersion.V4, hostilePath), [
            'dep', 'list', '--max-col-width', '0', hostilePath
        ]);
        assert.deepStrictEqual(helmInstallArgs(HelmSyntaxVersion.V3, chart, version, 'team-a'), [
            'install', chart, '--version', version, '--namespace', 'team-a', '--generate-name'
        ]);
        assert.strictEqual(helmFetchedChartDirectoryName('stable/nginx'), 'nginx');
        assert.strictEqual(helmFetchedChartDirectoryName('https://example.test/nginx.tgz'), undefined);
        assert.strictEqual(helmFetchedChartDirectoryName('oci://registry.test/charts/nginx'), undefined);
        assert.strictEqual(isExplicitHelmLocalChartReference('./charts/app'), true);
        assert.strictEqual(isExplicitHelmLocalChartReference('/tmp/charts/app'), true);
        assert.strictEqual(isExplicitHelmLocalChartReference('C:\\charts\\app'), true);
        assert.strictEqual(isExplicitHelmLocalChartReference('stable/app'), false);
        assert.strictEqual(isExplicitHelmLocalChartReference('oci://registry.test/charts/app'), false);
    });

    test('round-trips bounded chart queries and rejects ambiguous fields', () => {
        const chart = 'repo/chart & value#fragment%25;$(marker)';
        const version = '^1.2 || >=2.0';
        const query = helmChartQuery(chart, version);

        assert.deepStrictEqual(parseHelmChartQuery(query), { chart, version });
        assert.strictEqual(parseHelmChartQuery('chart=repo%2Fone&chart=repo%2Ftwo&version=1.2.3'), undefined);
        assert.strictEqual(parseHelmChartQuery(`chart=${'x'.repeat(9000)}`), undefined);
        assert.strictEqual(parseHelmChartQuery(helmChartQuery('x'.repeat(1025))), undefined);
        assert.strictEqual(parseHelmChartQuery(helmChartQuery('repo/chart', '1'.repeat(257))), undefined);
        assert.deepStrictEqual(parseHelmRepositoryChartQuery(helmChartQuery('repo/chart', 'v1.2')), {
            chart: 'repo/chart',
            version: 'v1.2',
        });
        assert.strictEqual(parseHelmRepositoryChartQuery(helmChartQuery('/tmp/chart', '1.2.3')), undefined);
        assert.strictEqual(parseHelmRepositoryChartQuery(helmChartQuery('oci://registry/chart', '1.2.3')), undefined);
        assert.strictEqual(parseHelmRepositoryChartQuery(helmChartQuery('repo/chart', '^1.2')), undefined);
    });

    test('uses field-specific chart and version validation', () => {
        assert.strictEqual(isSafeHelmChartReference('repo/chart;$(marker)&value'), true);
        assert.strictEqual(isSafeHelmChartReference('oci://registry.test/team/chart'), true);
        assert.strictEqual(isSafeHelmChartReference('https://example.test/chart.tgz?token=a&b=c'), true);
        assert.strictEqual(isSafeHelmChartReference('./local chart'), true);
        assert.strictEqual(isSafeHelmChartReference('/tmp/local chart'), true);
        assert.strictEqual(isSafeHelmChartReference('C:\\work dir\\chart.tgz'), true);
        assert.strictEqual(isSafeHelmChartReference('--help'), false);
        assert.strictEqual(isSafeHelmChartReference('repo/chart\nother'), false);
        assert.strictEqual(isSafeHelmChartVersion('1'), true);
        assert.strictEqual(isSafeHelmChartVersion('1.2'), true);
        assert.strictEqual(isSafeHelmChartVersion('v1.2'), true);
        assert.strictEqual(isSafeHelmChartVersion('1.2.3-rc.1+build'), true);
        assert.strictEqual(isSafeHelmChartVersion('^1.2 || >=2.0'), true);
        assert.strictEqual(isSafeHelmChartVersion('--devel'), false);
        assert.strictEqual(isSafeHelmRepositoryChartReference('myrepo/chart', 'MyRepo', true), true);
        assert.strictEqual(isSafeHelmRepositoryChartReference('repo/../chart', 'repo', false), false);
        assert.strictEqual(isSafeHelmRepositoryChartReference('C:/work/chart', 'C:', false), false);
        assert.strictEqual(isSafeHelmRepositoryName('..'), false);
        assert.strictEqual(isSafeHelmRepositoryName('.hidden'), false);
        assert.strictEqual(isSafeHelmRepositoryName('foo\\bar'), false);
        assert.strictEqual(isSafeHelmRepositoryChartVersion('1.2'), true);
        assert.strictEqual(isSafeHelmRepositoryChartVersion('v1.2.3'), true);
        assert.strictEqual(isSafeHelmRepositoryChartVersion('^1.2'), false);
    });

    test('constructs native and WSL invocations without rendering shell text', () => {
        const nativeShell = fakeShell(false);
        assert.deepStrictEqual(helmCommandInvocation({ path: '/opt/Helm Tools/helm' }, ['show', 'repo/chart;$(marker)'], nativeShell, false), {
            executable: '/opt/Helm Tools/helm',
            args: ['show', 'repo/chart;$(marker)'],
            cwd: '/workspace path',
            env: { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' },
        });
        assert.deepStrictEqual(helmCommandInvocation({ path: '/opt/Helm Tools/helm' }, ['show', 'repo/chart;$(marker)'], nativeShell, true), {
            executable: 'C:\\Windows\\System32\\wsl.exe',
            args: ['--exec', '/opt/Helm Tools/helm', 'show', 'repo/chart;$(marker)'],
            cwd: '/workspace path',
            env: { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' },
        });
    });

    test('rejects native Windows command scripts', () => {
        assert.throws(
            () => helmCommandInvocation({ path: 'C:\\tools\\helm.CMD' }, ['version'], fakeShell(true), false),
            /configure an \.exe path/
        );
    });

    test('preserves both output streams and exact argv through the executor', async () => {
        const execute = sinon.stub().resolves({ code: 7, stdout: 'partial stdout', stderr: 'helm error' });
        const onSpawn = sinon.stub();

        const result = await executeHelmCommand(
            { path: '/opt/helm' },
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
            env: { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' },
        }, undefined, onSpawn);
    });

    test('runs repository commands outside the workspace', () => {
        const shell = fakeShell(false);
        const cwd = helmRepositoryCommandCwd(shell, false);
        const invocation = helmCommandInvocation({ path: '/opt/helm' }, ['show', 'repo/chart'], shell, false, cwd);

        assert.strictEqual(cwd, path.parse(process.cwd()).root);
        assert.strictEqual(invocation.cwd, cwd);
    });

    test('converts only host paths for WSL execution', async () => {
        const execute = sinon.stub().resolves({ code: 0, stdout: '/mnt/c/work dir/chart\n', stderr: '' });

        assert.strictEqual(await helmPathForExecution('/tmp/chart', true, execute), '/tmp/chart');
        assert.strictEqual(
            await helmPathForExecution(
                'C:\\work dir\\chart',
                true,
                execute,
                { SystemRoot: 'C:\\Windows' }
            ),
            '/mnt/c/work dir/chart'
        );
        sinon.assert.calledOnceWithExactly(execute, {
            executable: 'C:\\Windows\\System32\\wsl.exe',
            args: ['--exec', '/usr/bin/wslpath', '-a', '-u', 'C:\\work dir\\chart'],
        });
    });

    test('round-trips absolute file queries and rejects relative or duplicate paths', () => {
        const posixPath = '/tmp/chart & value#fragment';
        const windowsPath = 'C:\\work dir\\chart %PATH%';

        assert.strictEqual(parseHelmFileQuery(helmFileQuery(posixPath)), posixPath);
        assert.strictEqual(
            parseHelmFileQuery(helmFileQuery(windowsPath)),
            process.platform === 'win32' ? windowsPath : undefined
        );
        assert.strictEqual(parseHelmFileQuery('path=--help'), undefined);
        assert.strictEqual(parseHelmFileQuery('path=%2Ftmp%2Fone&path=%2Ftmp%2Ftwo'), undefined);
    });

    test('pins an unconfigured Helm executable to a trusted PATH entry', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-path-'));
        const workspace = path.join(tempRoot, 'workspace');
        const binDir = path.join(tempRoot, 'bin');
        fs.mkdirSync(workspace);
        fs.mkdirSync(binDir);
        const executable = path.join(binDir, process.platform === 'win32' ? 'helm.exe' : 'helm');
        fs.writeFileSync(executable, '');
        const shell = fakeShell(process.platform === 'win32', executable, workspace, binDir);

        try {
            const helm = await resolveHelmExecutableForExecution(undefined, shell, false);
            assert.ok(helm);
            const invocation = helmCommandInvocation(helm, ['version'], shell, false);
            assert.strictEqual(invocation.executable, fs.realpathSync.native(executable));
            assert.strictEqual(invocation.argv0, executable);
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    test('rejects Helm from any folder in a multi-root workspace', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-multiroot-'));
        const firstWorkspace = path.join(tempRoot, 'first');
        const secondWorkspace = path.join(tempRoot, 'second');
        const binDir = path.join(secondWorkspace, 'bin');
        fs.mkdirSync(firstWorkspace);
        fs.mkdirSync(secondWorkspace);
        fs.mkdirSync(binDir);
        const executable = path.join(binDir, process.platform === 'win32' ? 'helm.exe' : 'helm');
        fs.writeFileSync(executable, '');
        const shell = fakeShell(process.platform === 'win32', executable, firstWorkspace, binDir);

        try {
            assert.strictEqual(
                await resolveHelmExecutableForExecution(undefined, shell, false, undefined, [firstWorkspace, secondWorkspace]),
                undefined
            );
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    test('resolves and executes Helm through pinned WSL binaries', async () => {
        const execute = sinon.stub();
        execute.onCall(0).resolves({ code: 0, stdout: '/usr/local/bin/helm\n', stderr: '' });
        execute.onCall(1).resolves({ code: 0, stdout: '/opt/helm/bin/helm\n', stderr: '' });
        execute.onCall(2).resolves({ code: 0, stdout: '', stderr: '' });
        execute.onCall(3).resolves({ code: 0, stdout: '/opt/helm/bin\n', stderr: '' });
        execute.onCall(4).resolves({ code: 0, stdout: '/workspace path\n', stderr: '' });

        const helm = await resolveHelmExecutableForExecution(undefined, fakeShell(false), true, execute);

        assert.deepStrictEqual(helm, { path: '/opt/helm/bin/helm' });
        sinon.assert.calledWithExactly(execute.getCall(0), {
            executable: 'C:\\Windows\\System32\\wsl.exe',
            args: ['--exec', '/usr/bin/which', 'helm'],
            cwd: '/workspace path',
            env: { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' },
        });
        assert.deepStrictEqual(
            helmCommandInvocation(helm!, ['version'], fakeShell(false), true).args,
            ['--exec', '/opt/helm/bin/helm', 'version']
        );
    });

    test('rejects WSL UNC paths before invoking wslpath', async () => {
        const execute = sinon.stub();
        await assert.rejects(
            () => helmPathForExecution('\\\\wsl$\\Ubuntu\\home\\user\\chart', true, execute, { SystemRoot: 'C:\\Windows' }),
            /WSL UNC share/
        );
        sinon.assert.notCalled(execute);
    });

    test('rejects an unconfigured WSL Helm resolved inside the workspace', async () => {
        const execute = sinon.stub();
        execute.onCall(0).resolves({ code: 0, stdout: '/workspace/helm\n', stderr: '' });
        execute.onCall(1).resolves({ code: 0, stdout: '/workspace/helm\n', stderr: '' });
        execute.onCall(2).resolves({ code: 0, stdout: '', stderr: '' });
        execute.onCall(3).resolves({ code: 0, stdout: '/workspace\n', stderr: '' });
        execute.onCall(4).resolves({ code: 0, stdout: '/workspace\n', stderr: '' });

        assert.strictEqual(
            await resolveHelmExecutableForExecution(undefined, fakeShell(false, null, '/workspace'), true, execute),
            undefined
        );
    });

    test('preserves Snap Helm dispatch through snap run in WSL', async () => {
        const execute = sinon.stub();
        execute.onCall(0).resolves({ code: 0, stdout: '/snap/bin/helm\n', stderr: '' });
        execute.onCall(1).resolves({ code: 0, stdout: '/usr/bin/snap\n', stderr: '' });
        execute.onCall(2).resolves({ code: 0, stdout: '', stderr: '' });
        execute.onCall(3).resolves({ code: 0, stdout: '/snap/bin\n', stderr: '' });
        execute.onCall(4).resolves({ code: 0, stdout: '/workspace\n', stderr: '' });
        execute.onCall(5).resolves({ code: 0, stdout: '/usr/bin/snap\n', stderr: '' });
        execute.onCall(6).resolves({ code: 0, stdout: '/usr/bin/snap\n', stderr: '' });
        execute.onCall(7).resolves({ code: 0, stdout: '', stderr: '' });

        const helm = await resolveHelmExecutableForExecution(undefined, fakeShell(false, null, '/workspace'), true, execute);

        assert.deepStrictEqual(helm, { path: '/usr/bin/snap', argsPrefix: ['run', '--', 'helm'] });
        assert.deepStrictEqual(
            helmCommandInvocation(helm!, ['version', '--short'], fakeShell(false), true).args,
            ['--exec', '/usr/bin/snap', 'run', '--', 'helm', 'version', '--short']
        );
    });

    test('fails closed for an invalid Snap Helm alias', async () => {
        const execute = sinon.stub();
        execute.onCall(0).resolves({ code: 0, stdout: '/snap/bin/helm\n', stderr: '' });
        execute.onCall(1).resolves({ code: 0, stdout: '/usr/bin/snap\n', stderr: '' });
        execute.onCall(2).resolves({ code: 0, stdout: '', stderr: '' });
        execute.onCall(3).resolves({ code: 0, stdout: '/snap/bin\n', stderr: '' });
        execute.onCall(4).resolves({ code: 0, stdout: '/workspace\n', stderr: '' });
        execute.onCall(5).resolves({ code: 0, stdout: '../invalid\n', stderr: '' });

        assert.strictEqual(
            await resolveHelmExecutableForExecution(undefined, fakeShell(false, null, '/workspace'), true, execute),
            undefined
        );
    });
});

function fakeShell(windows: boolean, whichResult: string | null = null, cwd = '/workspace path', pathValue = '/usr/bin'): Shell {
    return {
        isWindows: () => windows,
        isUnix: () => !windows,
        platform: () => { throw new Error('not used'); },
        home: () => '',
        combinePath: () => '',
        fileUri: () => { throw new Error('not used'); },
        execOpts: () => ({ cwd, env: { PATH: pathValue, SystemRoot: 'C:\\Windows' } }),
        exec: async () => undefined,
        execStreaming: async () => undefined,
        execCore: async () => ({ code: 0, stdout: '', stderr: '' }),
        unquotedPath: (value) => value,
        which: () => whichResult,
        cat: () => '',
        ls: () => [],
    };
}
