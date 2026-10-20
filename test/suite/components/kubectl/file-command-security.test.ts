import * as assert from 'assert';
import * as sinon from 'sinon';
import { Kubectl } from '../../../../src/kubectl';
import {
    fileCommandArgs,
    getResourceFileDataArgs,
    hostPathToWsl,
    invokeFileCommandWithFeedback,
    replaceFromStdin,
    replaceFromStdinArgs,
    wslPathArgs,
} from '../../../../src/components/kubectl/file-commands';

suite('File command security', () => {
    test('keeps POSIX and Windows paths as one argument', () => {
        const posixPath = '/tmp/manifest $(marker); touch file.yaml';
        const windowsPath = 'C:\\work dir\\manifest & marker %PATH%.yaml';

        assert.deepStrictEqual(fileCommandArgs('apply', posixPath, 'team-a'), [
            'apply', '--namespace', 'team-a', '-f', posixPath
        ]);
        assert.deepStrictEqual(fileCommandArgs('delete', windowsPath), [
            'delete', '-f', windowsPath
        ]);
    });

    test('leaves an existing WSL path unchanged', async () => {
        assert.strictEqual(await hostPathToWsl('/tmp/manifest.yaml'), '/tmp/manifest.yaml');
        assert.deepStrictEqual(wslPathArgs('C:\\work dir\\manifest.yaml'), [
            '--exec', 'wslpath', '-a', '-u', 'C:\\work dir\\manifest.yaml'
        ]);
    });

    test('surfaces WSL path conversion failures', async () => {
        const execute = sinon.stub().resolves({ code: 1, stdout: '', stderr: 'wslpath failed' });

        await assert.rejects(
            () => hostPathToWsl('C:\\work dir\\manifest.yaml', execute),
            /Unable to convert the Windows path for WSL\./
        );
        sinon.assert.calledOnceWithExactly(execute, {
            executable: 'wsl.exe',
            args: ['--exec', 'wslpath', '-a', '-u', 'C:\\work dir\\manifest.yaml'],
        });
    });

    test('invokes a file command through the argv API', async () => {
        const result = { resultKind: 'exec-succeeded', stdout: 'applied' } as const;
        const invokeCommandArgsWithFeedback = sinon.stub().resolves(result);
        const kubectl = { invokeCommandArgsWithFeedback } as unknown as Kubectl;
        const filePath = '/tmp/file with spaces;$(marker).yaml';

        const actual = await invokeFileCommandWithFeedback(
            kubectl,
            'apply',
            filePath,
            'team-a',
            'Applying...'
        );

        assert.strictEqual(actual, result);
        sinon.assert.calledOnceWithExactly(
            invokeCommandArgsWithFeedback,
            ['apply', '--namespace', 'team-a', '-f', filePath],
            'Applying...'
        );
    });

    test('passes replacement JSON only through stdin', async () => {
        const result = { resultKind: 'exec-succeeded', stdout: 'replaced' } as const;
        const invokeCommandArgs = sinon.stub().resolves(result);
        const kubectl = { invokeCommandArgs } as unknown as Kubectl;
        const content = JSON.stringify({ data: { key: 'value; $(marker) & %PATH%' } });

        const actual = await replaceFromStdin(kubectl, 'team-a', content);

        assert.strictEqual(actual, result);
        assert.deepStrictEqual(replaceFromStdinArgs('team-a'), [
            'replace', '-f', '-', '--namespace', 'team-a'
        ]);
        sinon.assert.calledOnceWithExactly(
            invokeCommandArgs,
            ['replace', '-f', '-', '--namespace', 'team-a'],
            content
        );
    });

    test('keeps resource identifiers separate during ConfigMap and Secret reads', () => {
        assert.deepStrictEqual(getResourceFileDataArgs('configmap', 'settings;$(marker)', 'team-a'), [
            'get', 'configmap', 'settings;$(marker)', '--namespace', 'team-a', '-o', 'json'
        ]);
    });
});
