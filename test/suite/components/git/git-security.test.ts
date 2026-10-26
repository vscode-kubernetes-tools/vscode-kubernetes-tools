import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import * as tmp from 'tmp';
import * as vscode from 'vscode';
import * as config from '../../../../src/components/config/config';
import * as processApi from '../../../../src/process';
import { Git, gitRevisionFromImage } from '../../../../src/components/git/git';
import { shell, Shell } from '../../../../src/shell';

const TEST_GIT_PATH = shell.which(process.platform === 'win32' ? 'git.exe' : 'git')?.trim() ||
    (process.platform === 'win32' ? 'C:\\Program Files\\Git\\cmd\\git.exe' : '/usr/bin/git');
const TEST_WORKSPACE = process.cwd();

suite('Git sync security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => sandbox.restore());

    test('extracts valid revisions from tagged images', () => {
        assert.strictEqual(gitRevisionFromImage('app:abc123'), 'abc123');
        assert.strictEqual(gitRevisionFromImage('registry.example:5000/team/app:release_1.2-3'), 'release_1.2-3');
        assert.strictEqual(gitRevisionFromImage(`app:${'a'.repeat(128)}`), 'a'.repeat(128));
    });

    test('rejects missing, digest, malformed, and hostile image tags', () => {
        for (const image of [
            'app',
            'registry.example:5000/team/app',
            'app:',
            ':revision',
            'app::revision',
            'app@sha256:0123456789abcdef',
            'app:--help',
            'app:main;$(marker)',
            'app:main\n',
            `app:${'a'.repeat(129)}`,
        ]) {
            assert.strictEqual(gitRevisionFromImage(image), undefined, image);
        }
    });

    test('resolves a revision and logs the resulting hash with exact arguments', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand');
        const resolvedCommit = '0123456789abcdef0123456789abcdef01234567';
        executeCommand.onFirstCall().resolves({ code: 0, stdout: `${resolvedCommit}\n`, stderr: '' });
        executeCommand.onSecondCall().resolves({ code: 0, stdout: '2 days ago\n', stderr: '' });
        const env = { PATH: path.dirname(TEST_GIT_PATH) };
        const gitAlias = path.join(path.dirname(TEST_GIT_PATH), process.platform === 'win32' ? 'git.exe' : 'git');
        const git = new Git(fakeShell(TEST_WORKSPACE, env));

        const resolved = await git.resolveCommit('release-1');
        if (!resolved.succeeded) {
            assert.fail(resolved.error.join('\n'));
        }
        const created = await git.whenCreated(resolved.result);

        assert.strictEqual(created, '2 days ago\n');
        sinon.assert.calledTwice(executeCommand);
        assert.deepStrictEqual(executeCommand.firstCall.args[0], {
            executable: fs.realpathSync.native(TEST_GIT_PATH),
            argv0: gitAlias,
            args: [
                '-c', 'core.warnAmbiguousRefs=true',
                'rev-parse', '--verify', 'release-1^{commit}'
            ],
            cwd: TEST_WORKSPACE,
            env,
        });
        assert.deepStrictEqual(executeCommand.secondCall.args[0], {
            executable: fs.realpathSync.native(TEST_GIT_PATH),
            argv0: gitAlias,
            args: ['log', '--pretty=%ar', '-n', '1', `${resolvedCommit}^{commit}`],
            cwd: TEST_WORKSPACE,
            env,
        });
    });

    test('uses WSL argv and checks out only the resolved commit hash', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        const executeCommand = sandbox.stub(processApi, 'executeCommand');
        const resolvedCommit = 'abcdef0123456789abcdef0123456789abcdef01';
        executeCommand.onFirstCall().resolves({ code: 0, stdout: `${resolvedCommit}\n`, stderr: '' });
        executeCommand.onSecondCall().resolves({ code: 0, stdout: '', stderr: '' });
        const git = new Git(fakeShell('C:\\workspace with spaces', { PATH: '/usr/bin' }));
        const previousSystemRoot = process.env.SystemRoot;
        process.env.SystemRoot = 'C:\\Windows';

        try {
            const resolved = await git.resolveCommit('release-1');
            if (!resolved.succeeded) {
                assert.fail(resolved.error.join('\n'));
            }
            const result = await git.checkout(resolved.result);

            assert.deepStrictEqual(result, { succeeded: true, result: null });
            sinon.assert.calledTwice(executeCommand);
            assert.deepStrictEqual(executeCommand.firstCall.args[0], {
                executable: path.win32.join('C:\\Windows', 'System32', 'wsl.exe'),
                args: [
                    '--exec', '/usr/bin/git', '-c', 'core.warnAmbiguousRefs=true',
                    'rev-parse', '--verify', 'release-1^{commit}'
                ],
                cwd: 'C:\\workspace with spaces',
            });
            assert.deepStrictEqual(executeCommand.secondCall.args[0], {
                executable: path.win32.join('C:\\Windows', 'System32', 'wsl.exe'),
                args: ['--exec', '/usr/bin/git', 'checkout', '--detach', `${resolvedCommit}^{commit}`],
                cwd: 'C:\\workspace with spaces',
            });
        } finally {
            restoreEnvironmentVariable('SystemRoot', previousSystemRoot);
        }
    });

    test('does not execute Git for an invalid revision', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand');
        const git = new Git(fakeShell(TEST_WORKSPACE, {}));

        for (const revision of ['--help', 'main;$(marker)', 'main\n', '', 'a'.repeat(129)]) {
            const result = await git.resolveCommit(revision);
            assert.deepStrictEqual(result, { succeeded: false, error: ['The image tag is not a valid Git revision.'] });
        }

        sinon.assert.notCalled(executeCommand);
    });

    test('does not check out unverified rev-parse output', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand').resolves({
            code: 0,
            stdout: 'not-a-commit\n',
            stderr: '',
        });
        const git = new Git(fakeShell(TEST_WORKSPACE, {}));

        const result = await git.resolveCommit('release-1');

        assert.deepStrictEqual(result, { succeeded: false, error: ['Git returned an invalid commit ID.'] });
        sinon.assert.calledOnce(executeCommand);
    });

    test('rejects ambiguous revision output instead of selecting a ref', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand').resolves({
            code: 0,
            stdout: '0123456789abcdef0123456789abcdef01234567\n',
            stderr: "warning: refname 'release-1' is ambiguous.\n",
        });
        const git = new Git(fakeShell(TEST_WORKSPACE, {}));

        const result = await git.resolveCommit('release-1');

        assert.deepStrictEqual(result, {
            succeeded: false,
            error: ["warning: refname 'release-1' is ambiguous."],
        });
        sinon.assert.calledOnce(executeCommand);
    });

    test('distinguishes Git launch and resolution failures', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand');
        executeCommand.onFirstCall().rejects(new Error('spawn failed'));
        executeCommand.onSecondCall().resolves({ code: 128, stdout: '', stderr: 'fatal: not a git repository\n' });
        const git = new Git(fakeShell(TEST_WORKSPACE, {}));

        assert.deepStrictEqual(await git.resolveCommit('release-1'), {
            succeeded: false,
            error: ['Unable to find or run Git.'],
        });
        assert.deepStrictEqual(await git.resolveCommit('release-1'), {
            succeeded: false,
            error: ['fatal: not a git repository'],
        });
        sinon.assert.calledTwice(executeCommand);
    });

    test('rejects nonstandard object ID lengths before checkout', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand');
        const git = new Git(fakeShell(TEST_WORKSPACE, {}));

        for (const commit of ['a'.repeat(39), 'a'.repeat(41), 'a'.repeat(63), 'a'.repeat(65)]) {
            assert.deepStrictEqual(await git.checkout(commit), {
                succeeded: false,
                error: ['The Git commit ID is not valid.'],
            });
        }

        sinon.assert.notCalled(executeCommand);
    });

    test('preserves checkout errors from Git', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand').resolves({
            code: 1,
            stdout: '',
            stderr: 'error: local changes would be overwritten\n',
        });
        const git = new Git(fakeShell(TEST_WORKSPACE, {}));

        const result = await git.checkout('0123456789abcdef0123456789abcdef01234567');

        assert.deepStrictEqual(result, {
            succeeded: false,
            error: ['error: local changes would be overwritten'],
        });
        sinon.assert.calledOnce(executeCommand);
    });

    test('does not launch an executable resolved from an empty workspace PATH entry', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand');
        const directory = tmp.dirSync({ unsafeCleanup: true });
        const workspaceGit = path.join(directory.name, process.platform === 'win32' ? 'git.exe' : 'git');
        fs.writeFileSync(workspaceGit, 'fixture');
        try {
            const git = new Git(fakeShell(
                directory.name,
                { PATH: `${path.delimiter}${path.dirname(TEST_GIT_PATH)}` },
                workspaceGit
            ));

            assert.deepStrictEqual(await git.resolveCommit('release-1'), {
                succeeded: false,
                error: ['Unable to find or run Git.'],
            });
            sinon.assert.notCalled(executeCommand);
        } finally {
            directory.removeCallback();
        }
    });

    test('fails closed when the workspace is a filesystem root', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand');
        const git = new Git(fakeShell(path.parse(TEST_GIT_PATH).root, { PATH: path.dirname(TEST_GIT_PATH) }));

        assert.deepStrictEqual(await git.resolveCommit('release-1'), {
            succeeded: false,
            error: ['Unable to find or run Git.'],
        });
        sinon.assert.notCalled(executeCommand);
    });

    test('allows Git below the extension host launch directory when outside the workspace', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand').resolves({
            code: 0,
            stdout: '0123456789abcdef0123456789abcdef01234567\n',
            stderr: '',
        });
        const directory = tmp.dirSync({ unsafeCleanup: true });
        const launchDirectory = path.join(directory.name, 'home');
        const gitDirectory = path.join(launchDirectory, '.local', 'bin');
        const workspace = path.join(directory.name, 'workspace');
        fs.mkdirSync(gitDirectory, { recursive: true });
        fs.mkdirSync(workspace);
        const gitPath = path.join(gitDirectory, process.platform === 'win32' ? 'git.exe' : 'git');
        fs.writeFileSync(gitPath, 'fixture');
        sandbox.stub(process, 'cwd').returns(launchDirectory);
        try {
            const git = new Git(fakeShell(workspace, { PATH: gitDirectory }, gitPath));

            assert.deepStrictEqual(await git.resolveCommit('release-1'), {
                succeeded: true,
                result: '0123456789abcdef0123456789abcdef01234567',
            });
            sinon.assert.calledOnce(executeCommand);
        } finally {
            directory.removeCallback();
        }
    });

    test('rejects Git reached through a symlinked workspace alias', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand');
        const directory = tmp.dirSync({ unsafeCleanup: true });
        const realWorkspace = path.join(directory.name, 'real-workspace');
        const workspaceAlias = path.join(directory.name, 'workspace-link');
        const gitDirectory = path.join(realWorkspace, 'bin');
        fs.mkdirSync(gitDirectory, { recursive: true });
        createDirectoryAlias(realWorkspace, workspaceAlias);
        const gitPath = path.join(gitDirectory, process.platform === 'win32' ? 'git.exe' : 'git');
        fs.writeFileSync(gitPath, 'fixture');
        try {
            const git = new Git(fakeShell(workspaceAlias, { PATH: gitDirectory }, gitPath));

            assert.deepStrictEqual(await git.resolveCommit('release-1'), {
                succeeded: false,
                error: ['Unable to find or run Git.'],
            });
            sinon.assert.notCalled(executeCommand);
        } finally {
            directory.removeCallback();
        }
    });

    test('rejects a PATH directory symlinked into the workspace', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand');
        const directory = tmp.dirSync({ unsafeCleanup: true });
        const workspace = path.join(directory.name, 'workspace');
        const realGitDirectory = path.join(workspace, 'tools');
        const pathAlias = path.join(directory.name, 'external-bin');
        fs.mkdirSync(realGitDirectory, { recursive: true });
        createDirectoryAlias(realGitDirectory, pathAlias);
        const executableName = process.platform === 'win32' ? 'git.exe' : 'git';
        const realGit = path.join(realGitDirectory, executableName);
        const aliasedGit = path.join(pathAlias, executableName);
        fs.writeFileSync(realGit, 'fixture');
        try {
            const git = new Git(fakeShell(workspace, { PATH: pathAlias }, aliasedGit));

            assert.deepStrictEqual(await git.resolveCommit('release-1'), {
                succeeded: false,
                error: ['Unable to find or run Git.'],
            });
            sinon.assert.notCalled(executeCommand);
        } finally {
            directory.removeCallback();
        }
    });

    test('rejects a workspace PATH alias whose executable points back outside', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand');
        const directory = tmp.dirSync({ unsafeCleanup: true });
        const workspace = path.join(directory.name, 'workspace');
        const workspaceGitDirectory = path.join(workspace, 'tools');
        const pathAlias = path.join(directory.name, 'external-bin');
        fs.mkdirSync(workspaceGitDirectory, { recursive: true });
        createDirectoryAlias(workspaceGitDirectory, pathAlias);
        const executableName = 'git';
        const workspaceGit = path.join(workspaceGitDirectory, executableName);
        const aliasedGit = path.join(pathAlias, executableName);
        createFileAlias(TEST_GIT_PATH, workspaceGit);
        try {
            const git = new Git(fakeShell(workspace, { PATH: pathAlias }, aliasedGit));

            assert.deepStrictEqual(await git.resolveCommit('release-1'), {
                succeeded: false,
                error: ['Unable to find or run Git.'],
            });
            sinon.assert.notCalled(executeCommand);
        } finally {
            directory.removeCallback();
        }
    });

    test('rejects a workspace-owned executable alias that points outside', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand');
        const directory = tmp.dirSync({ unsafeCleanup: true });
        const workspace = path.join(directory.name, 'workspace');
        const workspaceBin = path.join(workspace, 'bin');
        const trustedBin = path.join(directory.name, 'trusted-bin');
        fs.mkdirSync(workspaceBin, { recursive: true });
        fs.mkdirSync(trustedBin);
        const trustedGit = path.join(trustedBin, 'git');
        const workspaceGit = path.join(workspaceBin, 'git');
        fs.writeFileSync(trustedGit, 'fixture');
        createFileAlias(trustedGit, workspaceGit);
        try {
            const git = new Git(fakeShell(workspace, { PATH: workspaceBin }, workspaceGit));

            assert.deepStrictEqual(await git.resolveCommit('release-1'), {
                succeeded: false,
                error: ['Unable to find or run Git.'],
            });
            sinon.assert.notCalled(executeCommand);
        } finally {
            directory.removeCallback();
        }
    });

    test('launches the validated target with the original alias as argv0', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand').resolves({
            code: 0,
            stdout: '0123456789abcdef0123456789abcdef01234567\n',
            stderr: '',
        });
        const directory = tmp.dirSync({ unsafeCleanup: true });
        const workspace = path.join(directory.name, 'workspace');
        const realGitDirectory = path.join(directory.name, 'real-bin');
        const pathAlias = path.join(directory.name, 'alias-bin');
        fs.mkdirSync(workspace);
        fs.mkdirSync(realGitDirectory);
        createDirectoryAlias(realGitDirectory, pathAlias);
        const executableName = process.platform === 'win32' ? 'git.exe' : 'git';
        fs.writeFileSync(path.join(realGitDirectory, executableName), 'fixture');
        const aliasedGit = path.join(pathAlias, executableName);
        try {
            const git = new Git(fakeShell(workspace, { PATH: pathAlias }, aliasedGit));

            assert.deepStrictEqual(await git.resolveCommit('release-1'), {
                succeeded: true,
                result: '0123456789abcdef0123456789abcdef01234567',
            });
            assert.strictEqual(
                executeCommand.firstCall.args[0].executable,
                fs.realpathSync.native(path.join(realGitDirectory, executableName))
            );
            assert.strictEqual(executeCommand.firstCall.args[0].argv0, aliasedGit);
        } finally {
            directory.removeCallback();
        }
    });

    test('rejects Git from another folder in a multi-root workspace', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand');
        const directory = tmp.dirSync({ unsafeCleanup: true });
        const firstWorkspace = path.join(directory.name, 'first');
        const secondWorkspace = path.join(directory.name, 'second');
        const bin = path.join(secondWorkspace, 'bin');
        fs.mkdirSync(firstWorkspace);
        fs.mkdirSync(bin, { recursive: true });
        const executable = path.join(bin, process.platform === 'win32' ? 'git.exe' : 'git');
        fs.copyFileSync(TEST_GIT_PATH, executable);
        sandbox.stub(vscode.workspace, 'workspaceFolders').value([
            { uri: vscode.Uri.file(firstWorkspace), name: 'first', index: 0 },
            { uri: vscode.Uri.file(secondWorkspace), name: 'second', index: 1 },
        ]);
        try {
            const git = new Git(fakeShell(firstWorkspace, { PATH: bin }, executable));
            assert.strictEqual(await git.describe(firstWorkspace), undefined);
            sinon.assert.notCalled(executeCommand);
        } finally {
            directory.removeCallback();
        }
    });

    test('checks out the resolved object when a branch is named after its hash', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const gitPath = shell.which(process.platform === 'win32' ? 'git.exe' : 'git')?.trim();
        assert.ok(gitPath && path.isAbsolute(gitPath), 'Git must resolve to an absolute path');
        const directory = tmp.dirSync({ keep: true });
        const env = isolatedGitEnvironment(directory.name);

        try {
            await runGit(gitPath, directory.name, env, ['init', '--quiet']);
            await runGit(gitPath, directory.name, env, [
                '-c', 'user.name=Test User',
                '-c', 'user.email=test@example.com',
                'commit', '--allow-empty', '--quiet', '-m', 'first',
            ]);
            const firstCommit = await runGit(gitPath, directory.name, env, ['rev-parse', 'HEAD']);
            const git = new Git(fakeShell(directory.name, env, gitPath));
            assert.deepStrictEqual(await git.resolveCommit(firstCommit), { succeeded: true, result: firstCommit });

            await runGit(gitPath, directory.name, env, [
                '-c', 'user.name=Test User',
                '-c', 'user.email=test@example.com',
                'commit', '--allow-empty', '--quiet', '-m', 'second',
            ]);
            await runGit(gitPath, directory.name, env, ['branch', firstCommit, 'HEAD']);

            assert.deepStrictEqual(await git.checkout(firstCommit), { succeeded: true, result: null });
            assert.strictEqual(await runGit(gitPath, directory.name, env, ['rev-parse', 'HEAD']), firstCommit);
        } finally {
            try {
                fs.rmSync(directory.name, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
            } catch (err) {
                // Git for Windows can retain the repository handle until the extension host exits.
                if (process.platform !== 'win32' || (err as NodeJS.ErrnoException).code !== 'EPERM') {
                    throw err;
                }
            }
        }
    });
});

function fakeShell(cwd: string, env: NodeJS.ProcessEnv, gitPath = TEST_GIT_PATH): Shell {
    if (!Object.keys(env).some((name) => name.toLowerCase() === 'path')) {
        env.PATH = path.dirname(gitPath);
    }
    return {
        execOpts: () => ({ cwd, env }),
        which: () => gitPath,
    } as unknown as Shell;
}

function restoreEnvironmentVariable(name: string, value: string | undefined): void {
    if (value === undefined) {
        delete process.env[name];
    } else {
        process.env[name] = value;
    }
}

function createDirectoryAlias(target: string, alias: string): void {
    fs.symlinkSync(target, alias, process.platform === 'win32' ? 'junction' : 'dir');
}

function createFileAlias(target: string, alias: string): void {
    fs.symlinkSync(target, alias, 'file');
}

function isolatedGitEnvironment(cwd: string): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const name of Object.keys(env)) {
        if (name.toUpperCase().startsWith('GIT_')) {
            delete env[name];
        }
    }
    env.GIT_CONFIG_NOSYSTEM = '1';
    env.GIT_CONFIG_GLOBAL = path.join(cwd, 'missing-global-config');
    env.GIT_CONFIG_COUNT = '0';
    return env;
}

async function runGit(gitPath: string, cwd: string, env: NodeJS.ProcessEnv, args: readonly string[]): Promise<string> {
    const isolatedArgs = [
        '-c', 'commit.gpgSign=false',
        '-c', `core.hooksPath=${path.join(cwd, 'missing-hooks')}`,
        ...args,
    ];
    const result = await processApi.executeCommand({ executable: gitPath, args: isolatedArgs, cwd, env });
    assert.strictEqual(result.code, 0, result.stderr);
    return result.stdout.trim();
}
