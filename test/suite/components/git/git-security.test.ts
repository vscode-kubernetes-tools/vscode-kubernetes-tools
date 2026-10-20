import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import * as tmp from 'tmp';
import * as config from '../../../../src/components/config/config';
import * as processApi from '../../../../src/process';
import { Git, gitRevisionFromImage } from '../../../../src/components/git/git';
import { shell, Shell } from '../../../../src/shell';

const TEST_GIT_PATH = process.platform === 'win32' ? 'C:\\Program Files\\Git\\cmd\\git.exe' : '/usr/bin/git';

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
        const git = new Git(fakeShell('/workspace with spaces', env));

        const resolved = await git.resolveCommit('release-1');
        if (!resolved.succeeded) {
            assert.fail(resolved.error.join('\n'));
        }
        const created = await git.whenCreated(resolved.result);

        assert.strictEqual(created, '2 days ago\n');
        sinon.assert.calledTwice(executeCommand);
        assert.deepStrictEqual(executeCommand.firstCall.args[0], {
            executable: TEST_GIT_PATH,
            args: [
                '-c', 'core.warnAmbiguousRefs=true',
                'rev-parse', '--verify', '--end-of-options', 'release-1^{commit}'
            ],
            cwd: '/workspace with spaces',
            env,
        });
        assert.deepStrictEqual(executeCommand.secondCall.args[0], {
            executable: TEST_GIT_PATH,
            args: ['log', '--pretty=%ar', '-n', '1', `${resolvedCommit}^{commit}`],
            cwd: '/workspace with spaces',
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
                    'rev-parse', '--verify', '--end-of-options', 'release-1^{commit}'
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
        const git = new Git(fakeShell('/workspace', {}));

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
        const git = new Git(fakeShell('/workspace', {}));

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
        const git = new Git(fakeShell('/workspace', {}));

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
        const git = new Git(fakeShell('/workspace', {}));

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
        const git = new Git(fakeShell('/workspace', {}));

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
        const git = new Git(fakeShell('/workspace', {}));

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
        const workspace = process.platform === 'win32' ? 'C:\\workspace' : '/workspace';
        const workspaceGit = path.join(workspace, process.platform === 'win32' ? 'git.exe' : 'git');
        const git = new Git(fakeShell(workspace, { PATH: `${path.delimiter}${path.dirname(TEST_GIT_PATH)}` }, workspaceGit));

        assert.deepStrictEqual(await git.resolveCommit('release-1'), {
            succeeded: false,
            error: ['Unable to find or run Git.'],
        });
        sinon.assert.notCalled(executeCommand);
    });

    test('allows a trusted executable when the working directory is a filesystem root', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(process, 'cwd').returns(path.parse(TEST_GIT_PATH).root);
        const resolvedCommit = '0123456789abcdef0123456789abcdef01234567';
        const executeCommand = sandbox.stub(processApi, 'executeCommand').resolves({
            code: 0,
            stdout: `${resolvedCommit}\n`,
            stderr: '',
        });
        const git = new Git(fakeShell(path.parse(TEST_GIT_PATH).root, { PATH: path.dirname(TEST_GIT_PATH) }));

        assert.deepStrictEqual(await git.resolveCommit(resolvedCommit), { succeeded: true, result: resolvedCommit });
        sinon.assert.calledOnce(executeCommand);
    });

    test('does not trust an executable directory at the filesystem root', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const executeCommand = sandbox.stub(processApi, 'executeCommand');
        const root = path.parse(TEST_GIT_PATH).root;
        const rootGit = path.join(root, process.platform === 'win32' ? 'git.exe' : 'git');
        const git = new Git(fakeShell(root, { PATH: root }, rootGit));

        assert.deepStrictEqual(await git.resolveCommit('release-1'), {
            succeeded: false,
            error: ['Unable to find or run Git.'],
        });
        sinon.assert.notCalled(executeCommand);
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
            fs.rmSync(directory.name, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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
