import * as assert from 'assert';
import * as sinon from 'sinon';
import { window } from 'vscode';
import { Kubectl } from '../../../../src/kubectl';
import { runAsDeployment } from '../../../../src/kubectlUtils';
import { NodejsDebugProvider } from '../../../../src/debug/nodejsDebugProvider';
import {
    createJobFromCronJobArgs,
    exposeResourceArgs,
    remoteShellCommandArgs,
    restartResourceArgs,
    runImageArgs,
    scaleResourceArgs,
} from '../../../../src/components/kubectl/workload-commands';

suite('Workload command security', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => { sandbox = sinon.createSandbox(); });
    teardown(() => sandbox.restore());

    test('canonicalises mutation targets and keeps hostile names in one argument', () => {
        const target = 'Deployment api&$(marker)';
        assert.deepStrictEqual(scaleResourceArgs(target, 3), [
            'scale', '--replicas=3', 'deployment/api&$(marker)',
        ]);
        assert.deepStrictEqual(restartResourceArgs(target, 'team-a'), [
            'rollout', 'restart', 'deployment/api&$(marker)', '--namespace', 'team-a',
        ]);
        assert.deepStrictEqual(exposeResourceArgs(target, { port: '8080;$(marker)' }), [
            'expose', 'deployment/api&$(marker)', '--port=8080;$(marker)',
        ]);
        assert.deepStrictEqual(exposeResourceArgs(target, { type: 'LoadBalancer', port: 80 }), [
            'expose', 'deployment/api&$(marker)', '--type=LoadBalancer', '--port=80',
        ]);
    });

    test('rejects arbitrary command text instead of splitting it', () => {
        assert.strictEqual(scaleResourceArgs('deployment/api --filename=/tmp/marker', 1), undefined);
        assert.strictEqual(restartResourceArgs('--help', 'default'), undefined);
        assert.strictEqual(restartResourceArgs('deployment/api', 'team;$(marker)'), undefined);
        assert.strictEqual(exposeResourceArgs('deployment/api/name'), undefined);
    });

    test('builds run arguments without shell quoting', () => {
        assert.deepStrictEqual(runImageArgs('app&marker', 'registry/image:tag;$(marker)', {
            imagePullPolicy: 'Never',
            ports: [8080, 9229],
            environment: { MESSAGE: 'hello world;$(marker)' },
            additionalArgs: ['-i', '--attach=false', '--command', '--', '/bin/sh', '-c', 'node --inspect app.js; touch /tmp/remote'],
        }), [
            'run', 'app&marker', '--image=registry/image:tag;$(marker)', '--image-pull-policy=Never',
            '--port=8080', '--port=9229', '--env=MESSAGE=hello world;$(marker)',
            '-i', '--attach=false', '--command', '--', '/bin/sh', '-c', 'node --inspect app.js; touch /tmp/remote',
        ]);
        assert.strictEqual(runImageArgs('--help', 'image'), undefined);
    });

    test('keeps explicit shell syntax inside the remote container', () => {
        const command = 'node --inspect app.js; touch /tmp/remote';
        assert.deepStrictEqual(remoteShellCommandArgs(command), [
            '-i', '--attach=false', '--command', '--', '/bin/sh', '-c', command,
        ]);
    });

    test('builds CronJob jobs with separate namespace and source arguments', () => {
        assert.deepStrictEqual(createJobFromCronJobArgs('job&marker', 'source;$(marker)', 'team-a'), [
            'create', 'job', 'job&marker', '--namespace', 'team-a', '--from=cronjob/source;$(marker)',
        ]);
        assert.strictEqual(createJobFromCronJobArgs('--help', 'source'), undefined);
        assert.strictEqual(createJobFromCronJobArgs('job', 'source/name'), undefined);
        assert.strictEqual(createJobFromCronJobArgs('job', 'source', 'team&marker'), undefined);
        assert.deepStrictEqual(createJobFromCronJobArgs('job', 'source'), [
            'create', 'job', 'job', '--from=cronjob/source',
        ]);
    });

    test('runs debug deployments through argv with unquoted environment values', async () => {
        const invokeCommandArgs = sandbox.stub().resolves({ resultKind: 'exec-succeeded', stdout: 'created' });
        const kubectl = { invokeCommandArgs } as unknown as Kubectl;
        const debugCommand = 'node --inspect app.js; remote';

        assert.strictEqual(await runAsDeployment(
            kubectl,
            'app&marker',
            'local-image:tag',
            [8080, 9229],
            { MESSAGE: 'hello world;$(marker)' },
            debugCommand
        ), 'app&marker');
        sinon.assert.calledOnceWithExactly(invokeCommandArgs, [
            'run', 'app&marker', '--image=local-image:tag', '--image-pull-policy=Never',
            '--port=8080', '--port=9229', '--env=MESSAGE=hello world;$(marker)',
            '-i', '--attach=false', '--command', '--', '/bin/sh', '-c', debugCommand,
        ]);

        invokeCommandArgs.resetHistory();
        await runAsDeployment(kubectl, 'remote', 'registry.example/image:tag', [8080], {}, undefined);
        sinon.assert.calledOnceWithExactly(invokeCommandArgs, [
            'run', 'remote', '--image=registry.example/image:tag', '--port=8080',
        ]);
    });

    test('keeps the Node launch command in the remote shell argument', async () => {
        const command = 'node --inspect "app file.js"; echo remote';
        sandbox.stub(window, 'showInputBox').resolves(command);

        assert.deepStrictEqual(await new NodejsDebugProvider().getDebugArgs(), {
            cancelled: false,
            value: command,
        });
    });

    test('preserves Node launch cancellation', async () => {
        sandbox.stub(window, 'showInputBox').resolves(undefined);
        assert.deepStrictEqual(await new NodejsDebugProvider().getDebugArgs(), { cancelled: true });
    });
});
