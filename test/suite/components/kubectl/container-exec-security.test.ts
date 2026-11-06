import * as assert from 'assert';
import * as sinon from 'sinon';
import { containerExec, ContainerExecDependencies, parseContainerCommand } from '../../../../src/components/kubectl/container-exec';
import { Container, Pod } from '../../../../src/kuberesources.objectmodel';

suite('Container Exec argument security', () => {
    function dependencies(command = 'echo "hello world"'): ContainerExecDependencies {
        return {
            prompt: sinon.stub().resolves(command),
            selectPod: sinon.stub().resolves({ metadata: { name: 'api-0', namespace: 'team-a' } } as Pod),
            selectContainer: sinon.stub().resolves({ name: 'worker' } as Container),
            suggestedShell: sinon.stub().resolves('sh'),
            invoke: sinon.stub().resolves(),
            showError: sinon.stub().resolves(),
        };
    }

    test('Exec uses the selected namespace and exact remote arguments without allocating a TTY', async () => {
        const deps = dependencies('echo "hello world" "${env:SECRET}" "$(marker);&|<>"');
        await containerExec(false, deps);
        sinon.assert.calledOnceWithExactly(deps.invoke as sinon.SinonStub, [
            'exec', 'pod/api-0', '--namespace=team-a', '--container=worker', '--',
            'echo', 'hello world', '${env:SECRET}', '$(marker);&|<>',
        ], 'echo on api-0/worker');
        sinon.assert.notCalled(deps.suggestedShell as sinon.SinonStub);
        sinon.assert.notCalled(deps.showError as sinon.SinonStub);
    });

    test('prompted Terminal preserves -it and supports commands with arguments', async () => {
        const deps = dependencies('python -c "print(123)"');
        await containerExec(true, deps);
        sinon.assert.calledOnceWithExactly(deps.prompt as sinon.SinonStub, true);
        sinon.assert.calledOnceWithExactly(deps.invoke as sinon.SinonStub, [
            'exec', '-it', 'pod/api-0', '--namespace=team-a', '--container=worker', '--', 'python', '-c', 'print(123)',
        ], 'python on api-0/worker');
    });

    test('Explorer Terminal uses its own namespace and the suggested shell', async () => {
        const deps = dependencies();
        await containerExec(true, deps, { name: 'api-1', namespace: 'all' });
        sinon.assert.notCalled(deps.prompt as sinon.SinonStub);
        sinon.assert.notCalled(deps.selectPod as sinon.SinonStub);
        sinon.assert.calledOnceWithExactly(deps.selectContainer as sinon.SinonStub, { name: 'api-1', namespace: 'all' });
        sinon.assert.calledOnceWithExactly(deps.invoke as sinon.SinonStub, [
            'exec', '-it', 'pod/api-1', '--namespace=all', '--container=worker', '--', 'sh',
        ], 'sh on api-1/worker');
    });

    test('retains selected pod container data for the picker', async () => {
        const deps = dependencies('env');
        const containers = [{ name: 'worker', image: 'image' }];
        (deps.selectPod as sinon.SinonStub).resolves({ metadata: { name: 'api-0', namespace: 'team-a' }, spec: { containers } });
        await containerExec(false, deps);
        sinon.assert.calledOnceWithExactly(deps.selectContainer as sinon.SinonStub, {
            name: 'api-0', namespace: 'team-a', spec: { containers },
        });
    });

    test('preserves Windows executables, UNC paths, empty arguments and escaped quotes', () => {
        assert.deepStrictEqual(parseContainerCommand(String.raw`"C:\Program Files\tool.exe" "C:\data\file" '\\server\share\file' "" "say \"hello\""`), [
            'C:\\Program Files\\tool.exe', 'C:\\data\\file', '\\\\server\\share\\file', '', 'say "hello"',
        ]);
        assert.deepStrictEqual(parseContainerCommand('echo hello\\ world'), ['echo', 'hello world']);
        assert.deepStrictEqual(parseContainerCommand('echo $HOME %PATH% !COMSPEC! ${workspaceFolder}'), [
            'echo', '$HOME', '%PATH%', '!COMSPEC!', '${workspaceFolder}',
        ]);
    });

    test('keeps explicit shell scripts entirely inside the remote command', async () => {
        for (const [command, expected] of [
            ['sh -c "echo $HOME | cat"', ['sh', '-c', 'echo $HOME | cat']],
            ['cmd.exe /c "echo %PATH% & dir"', ['cmd.exe', '/c', 'echo %PATH% & dir']],
        ] as const) {
            const deps = dependencies(command);
            await containerExec(false, deps);
            assert.deepStrictEqual((deps.invoke as sinon.SinonStub).firstCall.args[0].slice(5), expected);
        }
    });

    test('handles trailing Windows backslashes without swallowing the next argument', () => {
        assert.deepStrictEqual(parseContainerCommand(String.raw`echo "C:\Program Files\\" next`), ['echo', 'C:\\Program Files\\', 'next']);
        assert.deepStrictEqual(parseContainerCommand(String.raw`echo "\\server\share\\" next`), ['echo', '\\\\server\\share\\', 'next']);
        assert.deepStrictEqual(parseContainerCommand(String.raw`echo "C:\data\\\\" next`), ['echo', 'C:\\data\\\\', 'next']);
        assert.deepStrictEqual(parseContainerCommand(String.raw`echo "slash\\\"quote" next`), ['echo', 'slash\\"quote', 'next']);
        assert.deepStrictEqual(parseContainerCommand(String.raw`echo 'C:\Program Files\' next`), ['echo', 'C:\\Program Files\\', 'next']);
        assert.strictEqual(parseContainerCommand(String.raw`echo "C:\Program Files\" next`), undefined);
    });

    test('rejects shell operators and malformed quoting before discovery or launch', async () => {
        for (const command of ['echo hello; touch marker', 'echo hello | cat', 'echo hello > file', 'echo `marker`', 'echo "unterminated', 'echo\nother', 'echo\0other', '"" argument', '   ']) {
            const deps = dependencies(command);
            await containerExec(false, deps);
            sinon.assert.notCalled(deps.selectPod as sinon.SinonStub);
            sinon.assert.notCalled(deps.invoke as sinon.SinonStub);
            sinon.assert.calledOnce(deps.showError as sinon.SinonStub);
        }
    });

    test('rejects invalid selected and Explorer identities before probes and launch', async () => {
        for (const target of [{ name: '--help', namespace: 'team-a' }, { name: 'api-0;$(marker)' }, { name: 'api-0', namespace: 'other --context victim' }]) {
            for (const explorer of [true, false]) {
                const deps = dependencies();
                (deps.selectPod as sinon.SinonStub).resolves({ metadata: target });
                await containerExec(true, deps, explorer ? target : undefined);
                sinon.assert.notCalled(deps.selectContainer as sinon.SinonStub);
                sinon.assert.notCalled(deps.suggestedShell as sinon.SinonStub);
                sinon.assert.notCalled(deps.invoke as sinon.SinonStub);
                sinon.assert.calledOnce(deps.showError as sinon.SinonStub);
            }
        }
        const deps = dependencies();
        (deps.selectContainer as sinon.SinonStub).resolves({ name: '--help' });
        await containerExec(true, deps, { name: 'api-0' });
        sinon.assert.notCalled(deps.suggestedShell as sinon.SinonStub);
        sinon.assert.notCalled(deps.invoke as sinon.SinonStub);
        sinon.assert.calledOnce(deps.showError as sinon.SinonStub);
    });

    test('cancellation at every picker leaves no command launched', async () => {
        for (const step of ['prompt', 'selectPod', 'selectContainer'] as const) {
            const deps = dependencies();
            (deps[step] as sinon.SinonStub).resolves(step === 'prompt' ? undefined : null);
            await containerExec(true, deps);
            sinon.assert.notCalled(deps.invoke as sinon.SinonStub);
            sinon.assert.notCalled(deps.showError as sinon.SinonStub);
        }
    });
});
