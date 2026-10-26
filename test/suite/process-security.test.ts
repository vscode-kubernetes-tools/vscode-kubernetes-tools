import * as assert from 'assert';
import { executeCommand, executeCommandPiped, ProcessExecutionError, snapPipeInvocation, spawnCommand } from '../../src/process';
import type { ChildProcess } from 'child_process';
import childProcesses = require('child_process');
import * as sinon from 'sinon';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';

suite('Process security', () => {
    test('passes hostile values as exact arguments without a shell', async () => {
        const values = [
            'plain value',
            '$(printf substituted)',
            '`printf substituted`',
            '; printf semicolon',
            '&& printf and',
            '| printf pipe',
            '> local-file',
            '%PATH%',
            '!COMSPEC!',
            'quote"single\'backslash\\',
            'line\ncarriage\rreturn',
        ];
        const result = await executeCommand({
            executable: process.execPath,
            args: ['-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', '--', ...values],
        });

        assert.strictEqual(result.code, 0);
        assert.strictEqual(result.stderr, '');
        assert.deepStrictEqual(JSON.parse(result.stdout), values);
    });

    test('passes stdin as data', async () => {
        const input = 'stdin; $(marker) & %PATH%\n';
        const result = await executeCommand({
            executable: process.execPath,
            args: ['-e', 'let value="";process.stdin.on("data",c=>value+=c);process.stdin.on("end",()=>process.stdout.write(value))'],
        }, input);

        assert.strictEqual(result.stdout, input);
    });

    test('preserves an executable alias through argv0', async () => {
        const child = spawnCommand({
            executable: process.execPath,
            argv0: '/external/bin/git',
            args: ['-e', 'process.stdout.write(process.argv0)'],
        });
        const output: Buffer[] = [];
        child.stdout?.on('data', (data: Buffer) => output.push(data));
        await new Promise<void>((resolve, reject) => {
            child.once('error', reject);
            child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`Exited with ${code}`)));
        });

        assert.strictEqual(Buffer.concat(output).toString('utf8'), '/external/bin/git');
    });

    test('does not report a signal-terminated pipeline source as successful', async () => {
        const result = await executeCommandPiped(
            {
                executable: process.execPath,
                args: ['-e', 'process.kill(process.pid, "SIGTERM")'],
            },
            {
                executable: process.execPath,
                args: ['-e', 'process.stdin.pipe(process.stdout)'],
            }
        );

        assert.notStrictEqual(result.code, 0);
    });

    test('keeps the Snap pipeline destination inside WSL', () => {
        assert.deepStrictEqual(snapPipeInvocation({
            executable: 'wsl.exe',
            args: ['--exec', '/usr/bin/kubectl', 'get', 'pods'],
            cwd: '/workspace',
            env: { PATH: '/usr/bin' },
        }, true), {
            executable: 'wsl.exe',
            args: ['--exec', 'cat'],
            cwd: '/workspace',
            env: { PATH: '/usr/bin' },
        });
    });

    test('cancels both pipeline processes and waits for their close events', async () => {
        const controller = new AbortController();
        let source: ChildProcess | undefined;
        let sourceClosed = false;
        const result = executeCommandPiped(
            { executable: process.execPath, args: ['-e', 'process.stdout.write("ready");setInterval(()=>{},1000)'] },
            { executable: process.execPath, args: ['-e', 'process.stdin.pipe(process.stdout)'] },
            undefined,
            (child) => { source = child; child.on('close', () => { sourceClosed = true; }); },
            { signal: controller.signal, onStdout: () => controller.abort() }
        );
        await assert.rejects(result, (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'cancelled');
        assert.ok(source);
        assert.strictEqual(sourceClosed, true);
    });

    test('retains the source exit status when the pipeline destination also fails', async () => {
        const result = await executeCommandPiped(
            { executable: process.execPath, args: ['-e', 'process.exit(7)'] },
            { executable: process.execPath, args: ['-e', 'process.stdin.resume();process.stdin.on("end",()=>process.exit(3))'] }
        );
        assert.strictEqual(result.code, 7);
    });

    test('cleans up the source if the pipeline destination cannot start', async () => {
        let sourceClosed = false;
        const result = executeCommandPiped(
            { executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] },
            { executable: '/no-such-kubectl-v2/cat', args: [] },
            undefined,
            (child) => child.on('close', () => { sourceClosed = true; })
        );
        await assert.rejects(result, (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'spawn-failed');
        assert.strictEqual(sourceClosed, true);
    });

    test('escalates cancellation when a Unix process ignores SIGTERM', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        const controller = new AbortController();
        let closed = false;
        const result = executeCommand(
            { executable: process.execPath, args: ['-e', 'process.on("SIGTERM",()=>{});process.stdout.write("ready");setInterval(()=>{},1000)'] },
            undefined,
            (child) => child.on('close', () => { closed = true; }),
            { signal: controller.signal, onStdout: () => controller.abort() }
        );
        await assert.rejects(result, (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'cancelled');
        assert.strictEqual(closed, true);
    });

    test('uses normal cleanup when pipeline startup throws synchronously', async () => {
        await assert.rejects(executeCommandPiped(
            { executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] },
            { executable: 'invalid\0destination', args: [] }
        ), (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'spawn-failed');
    });

    test('preserves a numeric source failure over a signalled destination', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        const result = await executeCommandPiped(
            { executable: process.execPath, args: ['-e', 'process.exit(7)'] },
            { executable: process.execPath, args: ['-e', 'process.stdin.resume();process.stdin.on("end",()=>process.kill(process.pid,"SIGTERM"))'] }
        );
        assert.strictEqual(result.code, 7);
        assert.strictEqual(result.signal, null);
    });

    test('stops an infinite source when the destination exits early', async () => {
        let source: ChildProcess | undefined;
        const result = await executeCommandPiped(
            { executable: process.execPath, args: ['-e', 'setInterval(()=>process.stdout.write("x".repeat(65536)),5)'] },
            { executable: process.execPath, args: ['-e', 'process.exit(3)'] },
            undefined,
            (child) => { source = child; }
        );
        assert.strictEqual(result.code, 3);
        assert.strictEqual(result.signal, null);
        assert.ok(source?.exitCode !== null || source?.signalCode !== null);
    });

    test('reports failure when a successful destination closes early', async () => {
        await assert.rejects(executeCommandPiped(
            { executable: process.execPath, args: ['-e', 'setInterval(()=>process.stdout.write("x"),5)'] },
            { executable: process.execPath, args: ['-e', 'process.exit(0)'] }
        ), (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'execution-failed');
    });

    test('cleans up a live source after stdout reaches EOF', async () => {
        const controller = new AbortController();
        let sourceClosed = false;
        let source: ChildProcess | undefined;
        const watchdog = setTimeout(() => controller.abort(), 7000);
        try {
            await assert.rejects(executeCommandPiped(
                { executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] },
                { executable: process.execPath, args: ['-e', 'process.stdin.resume();process.stdin.on("end",()=>process.exit(0))'] },
                undefined,
                (child) => {
                    source = child;
                    child.once('close', () => { sourceClosed = true; });
                    // Windows duplicates child stdio handles, so signal EOF on the parent stream.
                    child.stdout!.push(null);
                },
                { signal: controller.signal }
            ), (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'execution-failed');
            assert.strictEqual(source?.stdout?.readableEnded, true);
            assert.strictEqual(sourceClosed, true);
        } finally {
            clearTimeout(watchdog);
            controller.abort();
        }
    });

    test('keeps the signal of an early pipeline destination', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        const result = await executeCommandPiped(
            { executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] },
            { executable: process.execPath, args: ['-e', 'process.kill(process.pid,"SIGTERM")'] }
        );
        assert.strictEqual(result.code, -1);
        assert.strictEqual(result.signal, 'SIGTERM');
    });

    test('cancellation closes pipes inherited by a credential helper', async () => {
        const controller = new AbortController();
        const helper = 'setInterval(()=>{},1000)';
        const parent = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(helper)}],{stdio:['ignore','ignore',2]});process.stdout.write('ready');setInterval(()=>{},1000)`;
        await assert.rejects(executeCommand(
            { executable: process.execPath, args: ['-e', parent] }, undefined, undefined,
            { signal: controller.signal, onStdout: () => controller.abort() }
        ), (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'cancelled');
    });

    test('escalates cleanup of descendants after the direct child exits', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        const controller = new AbortController();
        let helperPid = 0;
        const helper = 'process.on("SIGTERM",()=>{});process.stderr.write(String(process.pid));setInterval(()=>{},1000)';
        const parent = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(helper)}],{stdio:['ignore','ignore',2]});setInterval(()=>{},1000)`;
        await assert.rejects(executeCommand(
            { executable: process.execPath, args: ['-e', parent] }, undefined, undefined,
            { signal: controller.signal, onStderr: (chunk) => { helperPid = Number(chunk); controller.abort(); } }
        ), (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'cancelled');
        assert.ok(helperPid > 0);
        let stopped = false;
        for (let attempt = 0; attempt < 20; attempt++) {
            const state = childProcesses.spawnSync('ps', ['-p', String(helperPid), '-o', 'stat='], { encoding: 'utf8', timeout: 2000 });
            if (state.status === 1 || state.stdout.trim().startsWith('Z')) {
                stopped = true;
                break;
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 50));
        }
        assert.ok(stopped, 'Credential helper survived process-group cleanup.');
    });

    test('uses literal taskkill arguments for Windows process-tree cleanup', async () => {
        const sandbox = sinon.createSandbox();
        const child = Object.assign(new EventEmitter(), {
            pid: 123, exitCode: null, signalCode: null,
            stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
            kill: sandbox.stub().callsFake(() => { child.emit('close', null, 'SIGKILL'); return true; }),
        });
        const killer = Object.assign(new EventEmitter(), { pid: 234, kill: sandbox.stub() });
        try {
            sandbox.stub(process, 'platform').value('win32');
            const spawn = sandbox.stub(childProcesses, 'spawn');
            spawn.onFirstCall().returns(child as unknown as ChildProcess);
            spawn.onSecondCall().callsFake(() => {
                queueMicrotask(() => killer.emit('close', 0));
                return killer as unknown as ChildProcess;
            });
            const controller = new AbortController();
            const result = executeCommand({ executable: 'kubectl.exe', args: ['get', 'pods'] }, undefined, undefined, { signal: controller.signal });
            child.emit('spawn');
            controller.abort();
            await assert.rejects(result, (error: unknown) => error instanceof ProcessExecutionError && error.reason === 'cancelled');
            assert.ok(spawn.secondCall.args[0].endsWith('taskkill.exe'));
            assert.deepStrictEqual(spawn.secondCall.args[1], ['/PID', '123', '/T', '/F']);
            assert.strictEqual((spawn.secondCall.args[2] as childProcesses.SpawnOptions).shell, false);
        } finally {
            sandbox.restore();
            child.stdin.destroy();
            child.stdout.destroy();
            child.stderr.destroy();
        }
    });

    test('does not signal its wrapper when cancellation races with ENOENT', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        const script = `const {executeCommand}=require(${JSON.stringify(require.resolve('../../src/process'))});
            const controller=new AbortController();
            const result=executeCommand({executable:'/no-such-kubectl-v2/isolated',args:[]},undefined,undefined,{signal:controller.signal});
            controller.abort();
            result.then(()=>process.exit(2),e=>process.exit(e.reason==='cancelled'?0:3));`;
        const wrapper = childProcesses.spawn(process.execPath, ['-e', script], {
            detached: true, stdio: 'ignore', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        });
        const timer = setTimeout(() => {
            if (wrapper.pid && wrapper.pid > 0) {
                try { process.kill(-wrapper.pid, 'SIGKILL'); } catch { /* Already exited. */ }
            }
        }, 5000);
        try {
            await new Promise<void>((resolve, reject) => {
                wrapper.once('error', reject);
                wrapper.once('close', (code, signal) => {
                    try {
                        assert.strictEqual(signal, null);
                        assert.strictEqual(code, 0);
                        resolve();
                    } catch (error) { reject(error); }
                });
            });
        } finally {
            clearTimeout(timer);
        }
    });
});
