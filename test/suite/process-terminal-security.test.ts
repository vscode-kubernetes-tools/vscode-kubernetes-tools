import * as assert from 'assert';
import * as nativeFs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { createProcessTerminalLaunch, host, ProcessTerminalExecution, ProcessTerminalLaunch } from '../../src/host';
import { executeCommand, spawnCommand } from '../../src/process';

interface RunnerPayload {
    readonly port: number;
}

suite('Process output terminal security', () => {
    test('runs the child inside a persistent real terminal TTY', async function () {
        this.timeout(15000);
        const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'kubectl-terminal-tty-'));
        const childDirectory = path.join(directory, '${workspaceFolder} child cwd');
        nativeFs.mkdirSync(childDirectory);
        const marker = path.join(directory, 'tty.json');
        const values = [
            '${env:VSCODE_K8S_SENTINEL}', '${config:setting}', '${command:test.sideEffect}',
            'space value', 'quote"single\'backslash\\', ';$(marker)', '%PATH%', '!COMSPEC!',
        ];
        const childScript = [
            'require("fs").writeFileSync(process.argv[1],JSON.stringify({',
            'args:process.argv.slice(2),cwd:process.cwd(),literal:process.env.KUBERNETES_LITERAL_TEST,pid:process.pid,sentinel:process.env.VSCODE_K8S_RUNNER_TEST,',
            'stdin:!!process.stdin.isTTY,stdout:!!process.stdout.isTTY,stderr:!!process.stderr.isTTY}))',
        ].join('');
        const existingTerminals = new Set(vscode.window.terminals);
        let terminal: vscode.Terminal | undefined;
        let terminalOpenListener: vscode.Disposable | undefined;
        const terminalOpened = new Promise<vscode.Terminal>((resolve) => {
            terminalOpenListener = vscode.window.onDidOpenTerminal((candidate) => {
                if (candidate.name === 'Kubernetes TTY Probe' && !existingTerminals.has(candidate)) {
                    terminalOpenListener?.dispose();
                    terminalOpenListener = undefined;
                    resolve(candidate);
                }
            });
        });
        let execution: ProcessTerminalExecution | undefined;
        try {
            execution = await host.runProcessInTerminal({
                name: 'Kubernetes TTY Probe',
                executable: process.execPath,
                args: ['-e', childScript, marker, ...values],
                cwd: childDirectory,
                env: {
                    ...process.env,
                    ELECTRON_RUN_AS_NODE: '1',
                    KUBERNETES_LITERAL_TEST: '${config:UNCHANGED}',
                    VSCODE_K8S_RUNNER_TEST: '${env:UNCHANGED}',
                },
            });
            terminal = await terminalOpened;
            await waitForFile(marker);
            const result = JSON.parse(nativeFs.readFileSync(marker, 'utf8'));
            await waitForProcessExit(result.pid);
            assert.deepStrictEqual(result, {
                args: values,
                cwd: nativeFs.realpathSync(childDirectory),
                literal: '${config:UNCHANGED}',
                pid: result.pid,
                sentinel: '${env:UNCHANGED}',
                stdin: true, stdout: true, stderr: true,
            });
            assert.ok(vscode.window.terminals.includes(terminal));
            execution.terminate();
            await execution.completed;
            execution = undefined;
            terminal = undefined;
        } finally {
            terminalOpenListener?.dispose();
            execution?.terminate();
            terminal?.dispose();
            nativeFs.rmSync(directory, { recursive: true, force: true });
        }
    });

    test('uses an authenticated loopback channel and keeps child data out of terminal options', async () => {
        const args = ['get', 'pod/${env:SECRET};$(marker)', '--namespace', 'team-a', '-o', 'wide'];
        const launch = await createProcessTerminalLaunch({
            name: 'Kubernetes Get',
            executable: '/opt/Kube Tools/kubectl',
            args,
            cwd: '/workspace path',
            env: { ...process.env, INCLUDED: 'yes', OMITTED: undefined },
        });
        try {
            const terminal = launch.terminalOptions;
            assert.deepStrictEqual(args, ['get', 'pod/${env:SECRET};$(marker)', '--namespace', 'team-a', '-o', 'wide']);
            assert.strictEqual(terminal.name, 'Kubernetes Get');
            assert.ok(Array.isArray(terminal.shellArgs));
            const runnerArgs = terminal.shellArgs as string[];
            if (process.platform === 'win32') {
                assert.match(terminal.shellPath!, /\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe$/i);
                assert.deepStrictEqual(runnerArgs.slice(0, 4), ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand']);
                assert.match(runnerArgs[4], /^[A-Za-z0-9+/=]+$/);
                assert.strictEqual(terminal.env!.ProgramFiles, process.env.ProgramFiles);
                assert.strictEqual(terminal.env!['ProgramFiles(x86)'], process.env['ProgramFiles(x86)']);
            } else {
                assert.strictEqual(terminal.shellPath, process.execPath);
                assert.strictEqual(runnerArgs.length, 3);
                assert.strictEqual(runnerArgs[0], '-e');
                assert.match(runnerArgs[2], /^[A-Za-z0-9_-]+$/);
                assert.ok(decodePayload(runnerArgs[2]).port > 0);
            }
            assert.ok(!runnerArgs.join('').includes('${env:SECRET}'));
            assert.match(terminal.env!.VSCODE_KUBERNETES_PROCESS_TOKEN!, /^[A-Za-z0-9_-]{43}$/);
            assert.strictEqual(terminal.env!.INCLUDED, undefined);
            assert.ok(!runnerArgs.join('').includes('/opt/Kube Tools/kubectl'));
            assert.ok(!JSON.stringify(terminal.env).includes('yes'));
            assert.strictEqual(terminal.cwd, path.parse(terminal.shellPath!).root);
            assert.strictEqual(terminal.strictEnv, true);
            assert.strictEqual(terminal.isTransient, true);
        } finally {
            launch.dispose();
            await launch.started.catch(() => {});
        }
    });

    test('passes variable-like and hostile values byte-for-byte through the runner', async () => {
        const values = [
            '${env:VSCODE_K8S_SENTINEL}', '${config:setting}', '${command:test.sideEffect}',
            'space value', 'quote"single\'backslash\\', ';$(marker)', '%PATH%', '!COMSPEC!',
        ];
        const childScript = 'process.stdout.write(JSON.stringify({args:process.argv.slice(1),sentinel:process.env.VSCODE_K8S_RUNNER_TEST}))';
        const launch = await createProcessTerminalLaunch({
            name: 'Kubernetes Get',
            executable: process.execPath,
            args: ['-e', childScript, '--', ...values],
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', VSCODE_K8S_RUNNER_TEST: 'preserved' },
        });
        try {
            const runnerArgs = launch.terminalOptions.shellArgs as string[];
            assert.ok(!runnerArgs.join('').includes('${env:VSCODE_K8S_SENTINEL}'));
            const result = await executeTerminalRunner(launch);
            assert.strictEqual(result.code, 0, result.stderr);
            assert.deepStrictEqual(JSON.parse(result.stdout), { args: values, sentinel: 'preserved' });
        } finally {
            launch.dispose();
        }
    });

    test('propagates child failures through the runner', async () => {
        const launch = await createProcessTerminalLaunch({
            name: 'Kubernetes Get',
            executable: process.execPath,
            args: ['-e', 'process.exit(7)'],
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        });
        try {
            const result = await executeTerminalRunner(launch);
            assert.strictEqual(result.code, 7);
        } finally {
            launch.dispose();
        }
    });

    test('keeps large environment entries out of a single launch value', async () => {
        const environment: NodeJS.ProcessEnv = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
        for (let index = 0; index < 100; index++) {
            environment[`VSCODE_K8S_LARGE_${index}`] = `${index}:` + 'x'.repeat(1024);
        }
        const childScript = 'for(let i=0;i<100;i++){if(process.env[`VSCODE_K8S_LARGE_${i}`]!==`${i}:`+"x".repeat(1024))process.exit(9)}';
        const launch = await createProcessTerminalLaunch({
            name: 'Kubernetes Environment Probe',
            executable: process.execPath,
            args: ['-e', childScript],
            env: environment,
        });
        try {
            assert.ok(Object.values(launch.terminalOptions.env!).every((value) => typeof value !== 'string' || value.length < 2048));
            assert.ok((launch.terminalOptions.shellArgs as string[]).join('').length < 16 * 1024);
            if (process.platform !== 'win32') {
                const result = await executeTerminalRunner(launch);
                assert.strictEqual(result.code, 0, result.stderr);
            }
        } finally {
            launch.dispose();
            await launch.started.catch(() => {});
        }
    });

    test('isolates wrapper-sensitive and transport-like environment names', async () => {
        const values = {
            NODE_DEBUG: 'child_process',
            NODE_OPTIONS: '--no-warnings',
            VSCODE_KUBERNETES_CHILD_COLLISION_0: 'transport-like',
            VSCODE_KUBERNETES_SECRET: 'do-not-log-this-secret',
        };
        const childScript = 'process.stdout.write(JSON.stringify(Object.fromEntries(process.argv.slice(1).map((key)=>[key,process.env[key]]))))';
        const launch = await createProcessTerminalLaunch({
            name: 'Kubernetes Sensitive Environment Probe',
            executable: process.execPath,
            args: ['-e', childScript, '--', ...Object.keys(values)],
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ...values },
        });

        try {
            const terminal = launch.terminalOptions;
            assert.strictEqual(terminal.env!.NODE_DEBUG, undefined);
            assert.strictEqual(terminal.env!.NODE_OPTIONS, undefined);
            assert.strictEqual(terminal.env!.VSCODE_KUBERNETES_SECRET, undefined);
            const result = await executeTerminalRunner(launch);
            assert.strictEqual(result.code, 0, result.stderr);
            assert.deepStrictEqual(JSON.parse(result.stdout), values);
            assert.ok(!result.stderr.includes(values.VSCODE_KUBERNETES_SECRET));
        } finally {
            launch.dispose();
        }
    });

    test('forwards terminal teardown signals to the child', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        this.timeout(10000);
        const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'kubectl-terminal-signal-'));
        const ready = path.join(directory, 'ready');
        const signalled = path.join(directory, 'signalled');
        const childScript = [
            'const fs=require("fs");',
            'process.on("SIGHUP",()=>{fs.writeFileSync(process.argv[2],"SIGHUP");process.exit(0)});',
            'fs.writeFileSync(process.argv[1],"ready");setInterval(()=>{},1000);',
        ].join('');
        const launch = await createProcessTerminalLaunch({
            name: 'Kubernetes Signal Probe',
            executable: process.execPath,
            args: ['-e', childScript, ready, signalled],
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        });
        const terminal = launch.terminalOptions;
        const wrapper = spawnCommand({
            executable: terminal.shellPath!,
            args: terminal.shellArgs as string[],
            cwd: terminal.cwd as string,
            env: definedEnvironment(terminal.env!),
        });
        await launch.started;
        const exited = waitForExit(wrapper);
        try {
            await waitForFile(ready);
            assert.strictEqual(wrapper.kill('SIGHUP'), true);
            assert.strictEqual(await exited, 0);
            assert.strictEqual(nativeFs.readFileSync(signalled, 'utf8'), 'SIGHUP');
        } finally {
            if (wrapper.exitCode === null && wrapper.signalCode === null) {
                wrapper.kill('SIGKILL');
            }
            launch.dispose();
            nativeFs.rmSync(directory, { recursive: true, force: true });
        }
    });
});

function decodePayload(value: string): RunnerPayload {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

async function executeTerminalRunner(launch: ProcessTerminalLaunch) {
    const terminal = launch.terminalOptions;
    const result = executeCommand({
        executable: terminal.shellPath!,
        args: terminal.shellArgs as string[],
        cwd: terminal.cwd as string,
        env: definedEnvironment(terminal.env!),
    });
    await launch.started;
    return await result;
}

async function waitForFile(file: string): Promise<void> {
    const deadline = Date.now() + 5000;
    while (!nativeFs.existsSync(file)) {
        if (Date.now() >= deadline) {
            throw new Error(`Timed out waiting for terminal child marker: ${file}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
}

function waitForExit(child: ReturnType<typeof spawnCommand>): Promise<number | null> {
    return new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
    });
}

async function waitForProcessExit(pid: number): Promise<void> {
    const deadline = Date.now() + 5000;
    while (isProcessRunning(pid)) {
        if (Date.now() >= deadline) {
            throw new Error(`Timed out waiting for terminal child process ${pid} to exit.`);
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
}

function isProcessRunning(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
}

function definedEnvironment(environment: NonNullable<vscode.TerminalOptions['env']>): NodeJS.ProcessEnv {
    return Object.fromEntries(
        Object.entries(environment).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
}
