import * as assert from 'assert';
import * as nativeFs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { Uri, workspace } from 'vscode';
import * as config from '../../../src/components/config/config';
import * as processApi from '../../../src/process';
import { shell } from '../../../src/shell';
import { dockerApiVersion } from '../../../src/docker/dockerUtils';
import { parseTaggedImageReference, requireTaggedImageReference, sanitiseRepositoryComponent } from '../../../src/image/imageReference';
import { getCurrentBuildTool, resolveImageTool } from '../../../src/image/imageToolRegistry';
import { buildImage, findVersion } from '../../../src/image/imageUtils';
import { ContainerImageBuildTool } from '../../../src/image/imageToolRegistry';
import { Kubectl } from '../../../src/kubectl';
import { runAsDeployment } from '../../../src/kubectlUtils';

suite('Image tool command security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => { sandbox = sinon.createSandbox(); });
    teardown(() => sandbox.restore());

    test('accepts tagged Docker references without changing them', () => {
        for (const image of [
            'app:c671dc5',
            'docker.io/team/app:latest',
            'REGISTRY.EXAMPLE.COM:5000/team/subteam/app:Tag_1.2-3',
            'localhost:5000/a__b/a---b:_tag',
            '[2001:db8::1]:5000/team/app:tag',
            `${'a'.repeat(247)}:tag`,
            `registry.example/team/${'a'.repeat(255 - 'team/'.length)}:${'t'.repeat(128)}`,
        ]) {
            assert.strictEqual(requireTaggedImageReference(image).value, image, image);
        }
        assert.deepStrictEqual(parseTaggedImageReference('registry.example:5000/team/app:tag'), {
            value: 'registry.example:5000/team/app:tag',
            registry: 'registry.example:5000',
            repository: 'team/app',
            repositoryLeaf: 'app',
            tag: 'tag',
        });
        assert.strictEqual(sanitiseRepositoryComponent('Project.Name'), 'project.name');
    });

    test('rejects malformed, digest, option-like, and hostile references', () => {
        for (const image of [
            '', 'app', 'app:', ':tag', '--help:tag', 'Team/App:tag', 'team//app:tag',
            'registry.example:/team/app:tag', 'registry.example:port/team/app:tag',
            'foo_bar.com/team/app:tag',
            'team/.app:tag', 'team/app.:tag', 'team/a___b:tag', 'team/a..b:tag',
            'docker://team/app:tag', 'team/app@sha256:0123456789abcdef',
            '[fe80::1%eth0]/team/app:tag', '[::ffff:192.0.2.1]/team/app:tag',
            'team/app:-tag', 'team/app:tag+bad', 'team/app:tag;$(marker)', 'team/app:tag\n',
            `team/app:${'t'.repeat(129)}`,
            `${'a'.repeat(248)}:tag`, `docker.io/${'a'.repeat(248)}:tag`,
        ]) {
            assert.strictEqual(parseTaggedImageReference(image), undefined, image);
        }
    });

    test('builds exact Docker argv and preserves cwd and environment', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(config, 'getImageBuildTool').returns('Docker');
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const fixture = executableFixture('docker');
        const env = { PATH: fixture.bin, BASE: 'yes' };
        sandbox.stub(shell, 'execOpts').returns({ cwd: fixture.cwd, env });
        sandbox.stub(shell, 'isWindows').returns(process.platform === 'win32');
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: 'ok', stderr: 'warning' });

        const tool = await getCurrentBuildTool({ cwd: fixture.cwd, env: { EXTRA: 'value' } });
        assert.deepStrictEqual(tool.buildArgs('registry.example:5000/team/app:tag'), [
            'build', '-t', 'registry.example:5000/team/app:tag', '.',
        ]);
        assert.deepStrictEqual(tool.pushArgs('registry.example:5000/team/app:tag'), [
            'push', 'registry.example:5000/team/app:tag',
        ]);
        assert.deepStrictEqual(await tool.execute(tool.buildArgs('app:tag')), {
            code: 0, stdout: 'ok', stderr: 'warning',
        });
        sinon.assert.calledOnceWithExactly(execute, {
            executable: nativeFs.realpathSync.native(fixture.executable),
            argv0: fixture.executable,
            args: ['build', '-t', 'app:tag', '.'],
            cwd: fixture.cwd,
            env: { ...env, EXTRA: 'value' },
        }, undefined, sinon.match.func);
        fixture.remove();
    });

    test('uses Buildah bud and rejects invalid images before execution', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const fixture = executableFixture('buildah');
        sandbox.stub(shell, 'execOpts').returns({ cwd: fixture.cwd, env: { PATH: fixture.bin } });
        sandbox.stub(shell, 'isWindows').returns(process.platform === 'win32');
        const execute = sandbox.stub(processApi, 'executeCommand');

        const tool = await resolveImageTool('Buildah', { cwd: fixture.cwd });
        assert.ok(tool);
        assert.deepStrictEqual(tool.buildArgs('team/app:tag'), ['bud', '-t', 'team/app:tag', '.']);
        assert.throws(() => tool.pushArgs('team/app:tag;$(marker)'), /Invalid tagged container image/);
        sinon.assert.notCalled(execute);
        fixture.remove();
    });

    test('rejects an executable resolved from a workspace PATH entry', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'image-tool-workspace-'));
        const bin = path.join(directory, 'bin');
        const alias = path.join(bin, process.platform === 'win32' ? 'docker.exe' : 'docker');
        nativeFs.mkdirSync(bin);
        nativeFs.copyFileSync(systemExecutable(), alias);
        sandbox.stub(workspace, 'workspaceFolders').value([{ uri: Uri.file(directory), name: 'workspace', index: 0 }]);
        sandbox.stub(shell, 'execOpts').returns({ cwd: os.tmpdir(), env: { PATH: bin } });
        sandbox.stub(shell, 'isWindows').returns(process.platform === 'win32');
        const execute = sandbox.stub(processApi, 'executeCommand');

        try {
            assert.strictEqual(await resolveImageTool('Docker', { cwd: os.tmpdir() }), undefined);
            sinon.assert.notCalled(execute);
        } finally {
            nativeFs.rmSync(directory, { recursive: true, force: true });
        }
    });

    test('pins WSL and executes the validated guest target', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const env = windowsEnvironment();
        sandbox.stub(shell, 'execOpts').returns({ cwd: 'C:\\workspace', env });
        sandbox.stub(shell, 'isWindows').returns(false);
        const execute = sandbox.stub(processApi, 'executeCommand').callsFake(async (invocation) => {
            const args = invocation.args;
            if (args[1] === '/usr/bin/which') { return { code: 0, stdout: '/usr/local/bin/docker\n', stderr: '' }; }
            if (args[1] === '/usr/bin/test') { return { code: 0, stdout: '', stderr: '' }; }
            if (args[1] === '/usr/bin/wslpath') { return { code: 0, stdout: '/mnt/c/workspace\n', stderr: '' }; }
            if (args[1] === '/usr/bin/readlink' && args[3] === '/usr/local/bin/docker') {
                return { code: 0, stdout: '/opt/docker/bin/docker\n', stderr: '' };
            }
            if (args[1] === '/usr/bin/readlink') { return { code: 0, stdout: `${args[3]}\n`, stderr: '' }; }
            return { code: 0, stdout: 'ok', stderr: '' };
        });

        const tool = await resolveImageTool('Docker', { cwd: 'C:\\workspace' });
        assert.ok(tool);
        assert.deepStrictEqual(await tool.execute(tool.pushArgs('team/app:tag')), { code: 0, stdout: 'ok', stderr: '' });
        sinon.assert.calledWithExactly(execute.lastCall, {
            executable: 'C:\\Windows\\System32\\wsl.exe',
            args: ['--exec', '/opt/docker/bin/docker', 'push', 'team/app:tag'],
            cwd: 'C:\\workspace',
            env: { ...env, PATH: '' },
        }, undefined, sinon.match.func);
    });

    test('passes explicit image environment overrides through WSL env argv', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const env = windowsEnvironment();
        sandbox.stub(shell, 'execOpts').returns({ cwd: 'C:\\workspace', env });
        sandbox.stub(shell, 'isWindows').returns(false);
        const execute = sandbox.stub(processApi, 'executeCommand').callsFake(async (invocation) => {
            const args = invocation.args;
            if (args[1] === '/usr/bin/which') { return { code: 0, stdout: '/usr/bin/docker\n', stderr: '' }; }
            if (args[1] === '/usr/bin/test') { return { code: 0, stdout: '', stderr: '' }; }
            if (args[1] === '/usr/bin/wslpath') { return { code: 0, stdout: '/mnt/c/workspace\n', stderr: '' }; }
            if (args[1] === '/usr/bin/readlink') { return { code: 0, stdout: `${args[3]}\n`, stderr: '' }; }
            return { code: 0, stdout: 'ok', stderr: '' };
        });

        const tool = await resolveImageTool('Docker', {
            cwd: 'C:\\workspace',
            env: { DOCKER_HOST: 'tcp://127.0.0.1:2376', DOCKER_TLS_VERIFY: '1' },
        });
        assert.ok(tool);
        await tool.execute(tool.pushArgs('team/app:tag'));
        assert.deepStrictEqual(execute.lastCall.args[0].args, [
            '--exec', '/usr/bin/env', 'DOCKER_HOST=tcp://127.0.0.1:2376', 'DOCKER_TLS_VERIFY=1',
            '/usr/bin/docker', 'push', 'team/app:tag',
        ]);
    });

    test('filters workspace PATH entries from the image tool environment', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const fixture = executableFixture('docker');
        const workspaceBin = path.join(fixture.cwd, 'bin');
        nativeFs.mkdirSync(workspaceBin);
        sandbox.stub(shell, 'execOpts').returns({
            cwd: fixture.cwd,
            env: { PATH: `${workspaceBin}${path.delimiter}${fixture.bin}`, DOCKER_CONFIG: fixture.cwd },
        });
        sandbox.stub(shell, 'isWindows').returns(process.platform === 'win32');
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: '', stderr: '' });

        const tool = await resolveImageTool('Docker', { cwd: fixture.cwd });
        assert.ok(tool);
        await tool.execute(tool.pushArgs('team/app:tag'));
        const environment = execute.firstCall.args[0].env!;
        const pathKey = Object.keys(environment).find((key) => key.toLowerCase() === 'path')!;
        assert.strictEqual(environment[pathKey], fixture.bin);
        assert.strictEqual(Object.keys(environment).some((key) => key.toLowerCase() === 'docker_config'), false);
        fixture.remove();
    });

    test('resolves inherited Docker config against the image build directory', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const fixture = executableFixture('docker');
        sandbox.stub(shell, 'execOpts').returns({
            cwd: process.cwd(),
            env: { PATH: fixture.bin, DOCKER_CONFIG: '.' },
        });
        sandbox.stub(shell, 'isWindows').returns(process.platform === 'win32');
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: '', stderr: '' });

        const tool = await resolveImageTool('Docker', { cwd: fixture.cwd });
        assert.ok(tool);
        await tool.execute(tool.pushArgs('team/app:tag'));
        const environment = execute.firstCall.args[0].env!;
        assert.strictEqual(Object.keys(environment).some((key) => key.toLowerCase() === 'docker_config'), false);
        fixture.remove();
    });

    test('normalizes inherited Docker config outside the image workspace', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const fixture = executableFixture('docker');
        const configDirectory = path.join(path.dirname(fixture.cwd), 'docker-config');
        nativeFs.mkdirSync(configDirectory);
        sandbox.stub(shell, 'execOpts').returns({
            cwd: process.cwd(),
            env: { PATH: fixture.bin, DOCKER_CONFIG: '../docker-config' },
        });
        sandbox.stub(shell, 'isWindows').returns(process.platform === 'win32');
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 0, stdout: '', stderr: '' });

        const tool = await resolveImageTool('Docker', { cwd: fixture.cwd });
        assert.ok(tool);
        await tool.execute(tool.pushArgs('team/app:tag'));
        const environment = execute.firstCall.args[0].env!;
        const configKey = Object.keys(environment).find((key) => key.toLowerCase() === 'docker_config');
        assert.ok(configKey);
        assert.strictEqual(environment[configKey], configDirectory);
        fixture.remove();
    });

    test('uses exact Docker API version argv and omits invalid output', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const fixture = executableFixture('docker');
        sandbox.stub(shell, 'execOpts').returns({ cwd: fixture.cwd, env: { PATH: fixture.bin } });
        sandbox.stub(shell, 'isWindows').returns(process.platform === 'win32');
        const execute = sandbox.stub(processApi, 'executeCommand');
        execute.onFirstCall().resolves({ code: 0, stdout: '1.45\n', stderr: '' });
        execute.onSecondCall().resolves({ code: 0, stdout: 'hostile output\n', stderr: '' });

        assert.strictEqual(await dockerApiVersion({ cwd: fixture.cwd }), '1.45');
        assert.deepStrictEqual(execute.firstCall.args[0].args, ['version', '--format', '{{.Client.APIVersion}}']);
        assert.strictEqual(await dockerApiVersion({ cwd: fixture.cwd }), undefined);
        fixture.remove();
    });

    test('stops the workflow after a failed image build', async () => {
        const execute = sandbox.stub().resolves({ code: 1, stdout: 'partial', stderr: 'build failed' });
        const tool = {
            displayName: 'Docker',
            binName: 'docker',
            buildArgs: () => ['build'],
            pushArgs: () => ['push'],
            execute,
        } as ContainerImageBuildTool;

        await assert.rejects(() => buildImage(tool, 'app:tag'), /Image build failed: build failed/);
        sinon.assert.calledOnceWithExactly(execute, ['build']);
    });

    test('uses latest outside Git and rejects invalid Git output in a repository', async () => {
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(workspace, 'workspaceFolders').value(undefined);
        const fixture = executableFixture('git');
        sandbox.stub(shell, 'execOpts').returns({ cwd: fixture.cwd, env: { PATH: fixture.bin } });
        const execute = sandbox.stub(processApi, 'executeCommand').resolves({ code: 1, stdout: '', stderr: 'describe failed' });

        assert.strictEqual(await findVersion(fixture.cwd), 'latest');
        nativeFs.mkdirSync(path.join(fixture.cwd, '.git'));
        await assert.rejects(() => findVersion(fixture.cwd), /describe failed/);
        sinon.assert.calledTwice(execute);
        fixture.remove();
    });

    test('classifies registry-port images as remotely pullable', async () => {
        const invokeCommandArgs = sandbox.stub().resolves({ resultKind: 'exec-succeeded', stdout: 'created' });
        const kubectl = { invokeCommandArgs } as unknown as Kubectl;

        await runAsDeployment(kubectl, 'app-debug', 'localhost:5000/team/app:tag', [], {});
        sinon.assert.calledOnceWithExactly(invokeCommandArgs, [
            'run', 'app-debug', '--image=localhost:5000/team/app:tag',
        ]);
    });

    test('rejects invalid images before deploying them', async () => {
        const invokeCommandArgs = sandbox.stub();
        const kubectl = { invokeCommandArgs } as unknown as Kubectl;

        await assert.rejects(
            () => runAsDeployment(kubectl, 'app-debug', 'team/app:tag;$(marker)', [], {}),
            /Invalid tagged container image/
        );
        sinon.assert.notCalled(invokeCommandArgs);
    });
});

function systemExecutable(): string {
    return process.platform === 'win32' ?
        path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'where.exe') : '/usr/bin/env';
}

function windowsEnvironment(): NodeJS.ProcessEnv {
    return { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' };
}

function executableFixture(name: string): { bin: string; cwd: string; executable: string; remove(): void } {
    const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'image-tool-'));
    const bin = path.join(directory, 'bin');
    const cwd = path.join(directory, 'workspace');
    nativeFs.mkdirSync(bin);
    nativeFs.mkdirSync(cwd);
    const executable = path.join(bin, process.platform === 'win32' ? `${name}.exe` : name);
    nativeFs.copyFileSync(systemExecutable(), executable);
    if (process.platform !== 'win32') {
        nativeFs.chmodSync(executable, 0o755);
    }
    return {
        bin,
        cwd,
        executable,
        remove: () => nativeFs.rmSync(directory, { recursive: true, force: true }),
    };
}
