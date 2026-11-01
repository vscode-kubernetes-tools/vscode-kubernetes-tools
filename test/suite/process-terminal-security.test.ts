import * as assert from 'assert';
import * as nativeFs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { createProcessTerminalOptions, host, ProcessTerminalExecution } from '../../src/host';
import { executeCommand, spawnCommand } from '../../src/process';

interface RunnerPayload {
    readonly executable: string;
    readonly args: string[];
    readonly cwd?: string;
}

suite('Process output terminal security', () => {
    test('runs the child inside a persistent real terminal TTY', async function () {
        this.timeout(15000);
        const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'kubectl-terminal-tty-'));
        const childDirectory = path.join(directory, '${env:UNCHANGED} child cwd');
        nativeFs.mkdirSync(childDirectory);
        const marker = path.join(directory, 'tty.json');
        const values = [
            '${env:VSCODE_K8S_SENTINEL}', '${config:setting}', '${command:test.sideEffect}',
            'space value', 'quote"single\'backslash\\', ';$(marker)', '%PATH%', '!COMSPEC!',
        ];
        const childScript = [
            'require("fs").writeFileSync(process.argv[1],JSON.stringify({',
            'args:process.argv.slice(2),cwd:process.cwd(),pid:process.pid,sentinel:process.env.VSCODE_K8S_RUNNER_TEST,',
            'stdin:!!process.stdin.isTTY,stdout:!!process.stdout.isTTY,stderr:!!process.stderr.isTTY}))',
        ].join('');
        const existingTerminals = new Set(vscode.window.terminals);
        let terminal: vscode.Terminal | undefined;
        let execution: ProcessTerminalExecution | undefined;
        try {
            execution = await host.runProcessInTerminal({
                name: 'Kubernetes TTY Probe',
                executable: process.execPath,
                args: ['-e', childScript, marker, ...values],
                cwd: childDirectory,
                env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', VSCODE_K8S_RUNNER_TEST: '${env:UNCHANGED}' },
            });
            terminal = vscode.window.terminals.find((candidate) =>
                candidate.name === 'Kubernetes TTY Probe' && !existingTerminals.has(candidate)
            );
            assert.ok(terminal);
            await waitForFile(marker);
            const result = JSON.parse(nativeFs.readFileSync(marker, 'utf8'));
            await waitForProcessExit(result.pid);
            assert.deepStrictEqual(result, {
                args: values,
                cwd: nativeFs.realpathSync(childDirectory),
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
            execution?.terminate();
            terminal?.dispose();
            nativeFs.rmSync(directory, { recursive: true, force: true });
        }
    });

    test('uses an encoded process runner and keeps short-lived output visible', () => {
        const args = ['get', 'pod/${env:SECRET};$(marker)', '--namespace', 'team-a', '-o', 'wide'];
        const terminal = createProcessTerminalOptions({
            name: 'Kubernetes Get',
            executable: '/opt/Kube Tools/kubectl',
            args,
            cwd: '/workspace path',
            env: { ...process.env, INCLUDED: 'yes', OMITTED: undefined },
        });

        assert.deepStrictEqual(args, ['get', 'pod/${env:SECRET};$(marker)', '--namespace', 'team-a', '-o', 'wide']);
        assert.strictEqual(terminal.name, 'Kubernetes Get');
        assert.strictEqual(terminal.shellPath, process.execPath);
        assert.ok(Array.isArray(terminal.shellArgs));
        const runnerArgs = terminal.shellArgs as string[];
        assert.strictEqual(runnerArgs.length, 3);
        assert.strictEqual(runnerArgs[0], '-e');
        assert.ok(!runnerArgs.join('').includes('${env:SECRET}'));
        assert.match(runnerArgs[2], /^[A-Za-z0-9_-]+$/);
        const payload = decodePayload(runnerArgs[2]);
        assert.strictEqual(payload.executable, '/opt/Kube Tools/kubectl');
        assert.deepStrictEqual(payload.args, args);
        assert.strictEqual(payload.cwd, '/workspace path');
        assert.strictEqual(terminal.env!.ELECTRON_RUN_AS_NODE, '1');
        assert.match(terminal.env!.VSCODE_KUBERNETES_PROCESS_ENV!, /^[A-Za-z0-9_-]+$/);
        assert.strictEqual(terminal.cwd, path.parse(process.execPath).root);
        assert.strictEqual(terminal.strictEnv, true);
        assert.strictEqual(terminal.isTransient, true);
        assert.strictEqual(terminal.env!.INCLUDED, undefined);
        const environment = decodeEnvironment(terminal.env!.VSCODE_KUBERNETES_PROCESS_ENV!);
        assert.strictEqual(environment.INCLUDED, 'yes');
        assert.strictEqual(environment.OMITTED, undefined);
    });

    test('passes variable-like and hostile values byte-for-byte through the runner', async () => {
        const values = [
            '${env:VSCODE_K8S_SENTINEL}', '${config:setting}', '${command:test.sideEffect}',
            'space value', 'quote"single\'backslash\\', ';$(marker)', '%PATH%', '!COMSPEC!',
        ];
        const childScript = 'process.stdout.write(JSON.stringify({args:process.argv.slice(1),sentinel:process.env.VSCODE_K8S_RUNNER_TEST}))';
        const terminal = createProcessTerminalOptions({
            name: 'Kubernetes Get',
            executable: process.execPath,
            args: ['-e', childScript, '--', ...values],
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', VSCODE_K8S_RUNNER_TEST: 'preserved' },
        });
        const runnerArgs = terminal.shellArgs as string[];

        assert.ok(!runnerArgs.join('').includes('${env:VSCODE_K8S_SENTINEL}'));
        const result = await executeCommand({
            executable: terminal.shellPath!,
            args: runnerArgs,
            cwd: terminal.cwd as string,
            env: definedEnvironment(terminal.env!),
        });

        assert.strictEqual(result.code, 0, result.stderr);
        assert.deepStrictEqual(JSON.parse(result.stdout), { args: values, sentinel: 'preserved' });
    });

    test('propagates child failures through the runner', async () => {
        const terminal = createProcessTerminalOptions({
            name: 'Kubernetes Get',
            executable: process.execPath,
            args: ['-e', 'process.exit(7)'],
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        });
        const result = await executeCommand({
            executable: terminal.shellPath!,
            args: terminal.shellArgs as string[],
            cwd: terminal.cwd as string,
            env: definedEnvironment(terminal.env!),
        });
        assert.strictEqual(result.code, 7);
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
        const terminal = createProcessTerminalOptions({
            name: 'Kubernetes Signal Probe',
            executable: process.execPath,
            args: ['-e', childScript, ready, signalled],
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        });
        const wrapper = spawnCommand({
            executable: terminal.shellPath!,
            args: terminal.shellArgs as string[],
            cwd: terminal.cwd as string,
            env: definedEnvironment(terminal.env!),
        });
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
            nativeFs.rmSync(directory, { recursive: true, force: true });
        }
    });
});

function decodePayload(value: string): RunnerPayload {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as RunnerPayload;
}

function decodeEnvironment(value: string): NodeJS.ProcessEnv {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as NodeJS.ProcessEnv;
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
