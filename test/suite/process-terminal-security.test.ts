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
    test('runs child output inside a persistent real terminal TTY', async function () {
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
            'const fs=require("fs");const {execFileSync}=require("child_process");',
            'const hasControllingTerminal=process.platform==="win32"||(()=>{try{const fd=fs.openSync("/dev/tty","r");fs.closeSync(fd);return true}catch{return false}})();',
            'const isForeground=process.platform==="win32"||execFileSync("/bin/ps",["-o","pgid=","-p",String(process.pid)]).toString().trim()===execFileSync("/bin/ps",["-o","tpgid=","-p",String(process.pid)]).toString().trim();',
            'const pendingMarker=process.argv[1]+".pending";fs.writeFileSync(pendingMarker,JSON.stringify({',
            'args:process.argv.slice(2),cwd:process.cwd(),literal:process.env.KUBERNETES_LITERAL_TEST,pid:process.pid,sentinel:process.env.VSCODE_K8S_RUNNER_TEST,',
            'controllingTerminal:hasControllingTerminal,foreground:isForeground,stdin:!!process.stdin.isTTY,stdout:!!process.stdout.isTTY,stderr:!!process.stderr.isTTY}));fs.renameSync(pendingMarker,process.argv[1]);',
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
                executable: terminalInputProbeExecutable(),
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
                controllingTerminal: true,
                foreground: true,
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

    test('reads interactive terminal input for login plugins', async function () {
        this.timeout(15000);
        const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'kubectl-terminal-input-'));
        const ready = path.join(directory, 'ready');
        const marker = path.join(directory, 'input.json');
        const name = 'Kubernetes Login Input Probe';
        let execution: ProcessTerminalExecution | undefined;
        try {
            execution = await host.runProcessInTerminal({
                name,
                executable: terminalInputProbeExecutable(),
                args: ['-e', [
                    'const fs=require("fs");let input="";',
                    'process.stdin.setEncoding("utf8");process.stdin.on("data",chunk=>{input+=chunk;if(input.includes("\\n")||input.includes("\\r")){fs.writeFileSync(process.argv[2],JSON.stringify({input:input.trim(),tty:!!process.stdin.isTTY}));process.exit(0)}});',
                    'fs.writeFileSync(process.argv[1],"ready");',
                ].join(''), ready, marker],
                env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
            });
            await waitForFile(ready);
            const terminal = vscode.window.terminals.find((candidate) => candidate.name === name);
            assert.ok(terminal);
            terminal.sendText('login-code-123');
            await waitForFile(marker);
            assert.deepStrictEqual(JSON.parse(nativeFs.readFileSync(marker, 'utf8')), { input: 'login-code-123', tty: true });
        } finally {
            execution?.terminate();
            nativeFs.rmSync(directory, { recursive: true, force: true });
        }
    });

    test('resolves a bare Windows executable using the child PATH', async function () {
        if (process.platform !== 'win32') {
            this.skip();
        }
        this.timeout(15000);
        const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path'));
        const launch = await createProcessTerminalLaunch({
            name: 'Kubernetes PATH Probe',
            executable: path.basename(process.execPath),
            args: ['-e', 'process.stdout.write("resolved-from-child-path")'],
            env: { ...environment, Path: path.dirname(process.execPath), ELECTRON_RUN_AS_NODE: '1' },
        });
        try {
            assert.ok(!launch.terminalOptions.env!.Path!.includes(path.dirname(process.execPath)));
            const result = await executeTerminalRunner(launch);
            assert.strictEqual(result.code, 0, result.stderr);
            assert.strictEqual(result.stdout, 'resolved-from-child-path');
        } finally {
            launch.dispose();
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
                assert.strictEqual(terminal.env!.VSCODE_KUBERNETES_PROCESS_PERSIST, '1');
                const port = Number(terminal.env!.VSCODE_KUBERNETES_PROCESS_PORT);
                assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
                assert.ok(process.env.USERPROFILE);
                assert.ok(process.env.LOCALAPPDATA);
                assert.ok(process.env.APPDATA);
                assert.strictEqual(terminal.env!.USERPROFILE, process.env.USERPROFILE);
                assert.strictEqual(terminal.env!.LOCALAPPDATA, process.env.LOCALAPPDATA);
                assert.strictEqual(terminal.env!.APPDATA, process.env.APPDATA);
                assert.strictEqual(terminal.env!.COR_ENABLE_PROFILING, undefined);
                assert.strictEqual(terminal.env!.NODE_OPTIONS, undefined);
                assert.strictEqual(terminal.env!.VSCODE_IPC_HOOK_CLI, undefined);
                const powershellRoot = path.win32.dirname(terminal.shellPath!);
                const systemRoot = path.win32.resolve(powershellRoot, '..', '..', '..');
                assert.strictEqual(terminal.env!.SystemRoot, systemRoot);
                assert.strictEqual(terminal.env!.windir, systemRoot);
                assert.strictEqual(terminal.env!.Path, [path.win32.join(systemRoot, 'System32'), systemRoot, powershellRoot].join(';'));
                assert.strictEqual(terminal.env!.PATHEXT, '.COM;.EXE;.BAT;.CMD');
                assert.strictEqual(terminal.env!.ComSpec, path.win32.join(systemRoot, 'System32', 'cmd.exe'));
                assert.strictEqual(terminal.env!.PSModulePath, path.win32.join(powershellRoot, 'Modules'));
            } else {
                assert.strictEqual(terminal.shellPath, process.execPath);
                assert.strictEqual(runnerArgs.length, 5);
                assert.strictEqual(runnerArgs[0], '-e');
                assert.match(runnerArgs[2], /^[A-Za-z0-9_-]+$/);
                assert.ok(decodePayload(runnerArgs[2]).port > 0);
                assert.ok(runnerArgs[3].includes('fg %1'));
                assert.ok(runnerArgs[4].includes('spawn(payload.executable,payload.args'));
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

    test('cancels a pending terminal before publishing or starting its child', async () => {
        const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'kubectl-terminal-cancel-'));
        const marker = path.join(directory, 'started');
        const cancellation = new AbortController();
        const existingTerminals = new Set(vscode.window.terminals);
        try {
            const execution = host.runProcessInTerminal({
                name: 'Kubernetes Cancelled Probe',
                executable: process.execPath,
                args: ['-e', 'require("fs").writeFileSync(process.argv[1],"started")', marker],
                env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
            }, cancellation.signal);
            cancellation.abort();

            await assert.rejects(execution, /Process terminal launch cancelled/);
            assert.strictEqual(nativeFs.existsSync(marker), false);
            assert.strictEqual(
                vscode.window.terminals.some((terminal) => terminal.name === 'Kubernetes Cancelled Probe' && !existingTerminals.has(terminal)),
                false
            );
        } finally {
            vscode.window.terminals
                .filter((terminal) => terminal.name === 'Kubernetes Cancelled Probe' && !existingTerminals.has(terminal))
                .forEach((terminal) => terminal.dispose());
            nativeFs.rmSync(directory, { recursive: true, force: true });
        }
    });

    test('closes command-owned helpers with the real terminal', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        this.timeout(15000);
        const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'kubectl-terminal-real-helper-'));
        const marker = path.join(directory, 'processes.json');
        const environmentSecret = `process-terminal-secret-${process.pid}-${Date.now()}`;
        let childPid: number | undefined;
        let helperPid: number | undefined;
        let execution: ProcessTerminalExecution | undefined;
        const childScript = [
            'const fs=require("fs");const {execFileSync,spawn}=require("child_process");',
            'const helperCode="for(const signal of [\\"SIGHUP\\",\\"SIGINT\\",\\"SIGQUIT\\",\\"SIGTERM\\"])process.on(signal,()=>{});setInterval(()=>{},1000)";',
            'const helper=spawn(process.execPath,["-e",helperCode],{env:process.env,stdio:"ignore"});',
            'const commands=execFileSync("/bin/ps",["-axo","command="],{encoding:"utf8"});',
            'helper.unref();fs.writeFileSync(process.argv[1],JSON.stringify({child:process.pid,helper:helper.pid,secretInProcessArgs:commands.includes(process.env.PROCESS_TERMINAL_ARGV_SECRET)}));',
            'setInterval(()=>{},1000);',
        ].join('');
        try {
            execution = await host.runProcessInTerminal({
                name: 'Kubernetes Helper Terminal Probe',
                executable: process.execPath,
                args: ['-e', childScript, marker],
                env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PROCESS_TERMINAL_ARGV_SECRET: environmentSecret },
            });
            await waitForFile(marker);
            const processes = JSON.parse(nativeFs.readFileSync(marker, 'utf8'));
            childPid = processes.child;
            helperPid = processes.helper;
            assert.strictEqual(processes.secretInProcessArgs, false);
            assert.ok(Number.isInteger(childPid) && childPid! > 0);
            assert.ok(Number.isInteger(helperPid) && helperPid! > 0);

            execution.terminate();
            await execution.completed;
            execution = undefined;
            await Promise.all([waitForProcessExit(childPid!), waitForProcessExit(helperPid!)]);
        } finally {
            execution?.terminate();
            for (const pid of [childPid, helperPid]) {
                if (pid && isProcessRunning(pid)) {
                    process.kill(pid, 'SIGKILL');
                }
            }
            vscode.window.terminals
                .filter((terminal) => terminal.name === 'Kubernetes Helper Terminal Probe')
                .forEach((terminal) => terminal.dispose());
            nativeFs.rmSync(directory, { recursive: true, force: true });
        }
    });

    test('cleans up a resistant helper after the command exits', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        this.timeout(15000);
        const directory = nativeFs.mkdtempSync(path.join(os.tmpdir(), 'kubectl-terminal-exited-helper-'));
        const marker = path.join(directory, 'processes.json');
        let childPid: number | undefined;
        let helperPid: number | undefined;
        let execution: ProcessTerminalExecution | undefined;
        const childScript = [
            'const fs=require("fs");const {spawn}=require("child_process");',
            'const helperCode="for(const signal of [\\"SIGHUP\\",\\"SIGINT\\",\\"SIGQUIT\\",\\"SIGTERM\\"])process.on(signal,()=>{});setInterval(()=>{},1000)";',
            'const helper=spawn(process.execPath,["-e",helperCode],{env:process.env,stdio:"ignore"});',
            'helper.unref();fs.writeFileSync(process.argv[1],JSON.stringify({child:process.pid,helper:helper.pid}));',
        ].join('');
        try {
            execution = await host.runProcessInTerminal({
                name: 'Kubernetes Exited Helper Probe',
                executable: process.execPath,
                args: ['-e', childScript, marker],
                env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
            });
            await waitForFile(marker);
            const processes = JSON.parse(nativeFs.readFileSync(marker, 'utf8'));
            childPid = processes.child;
            helperPid = processes.helper;
            await Promise.all([waitForProcessExit(childPid!), waitForProcessExit(helperPid!)]);
            assert.ok(vscode.window.terminals.some((terminal) => terminal.name === 'Kubernetes Exited Helper Probe'));
        } finally {
            execution?.terminate();
            for (const pid of [childPid, helperPid]) {
                if (pid && isProcessRunning(pid)) {
                    process.kill(pid, 'SIGKILL');
                }
            }
            vscode.window.terminals
                .filter((terminal) => terminal.name === 'Kubernetes Exited Helper Probe')
                .forEach((terminal) => terminal.dispose());
            nativeFs.rmSync(directory, { recursive: true, force: true });
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
            VSCODE_KUBERNETES_PROCESS_PERSIST: 'child-persist',
            VSCODE_KUBERNETES_PROCESS_PORT: 'child-port',
            VSCODE_KUBERNETES_PROCESS_TOKEN: 'child-token',
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
        const environment = definedEnvironment(terminal.env!);
        environment.VSCODE_KUBERNETES_PROCESS_PERSIST = '0';
        const wrapper = spawnCommand({
            executable: terminal.shellPath!,
            args: terminal.shellArgs as string[],
            cwd: terminal.cwd as string,
            env: environment,
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

function terminalInputProbeExecutable(): string {
    if (process.platform !== 'win32') {
        return process.execPath;
    }
    // Electron's GUI executable has different CRT stdin initialization from the
    // console applications (kubectl and credential plugins) this runner starts.
    const node = process.env.npm_node_execpath;
    assert.ok(node && path.isAbsolute(node), 'Run Windows terminal probes through npm test to select native Node.');
    return node;
}

async function executeTerminalRunner(launch: ProcessTerminalLaunch) {
    const terminal = launch.terminalOptions;
    const environment = definedEnvironment(terminal.env!);
    environment.VSCODE_KUBERNETES_PROCESS_PERSIST = '0';
    const resultPromise = executeCommand({
        executable: terminal.shellPath!,
        args: terminal.shellArgs as string[],
        cwd: terminal.cwd as string,
        env: environment,
    });
    const startup = await Promise.race([
        launch.started.then(() => undefined),
        resultPromise.then((result) => result),
    ]);
    if (startup) {
        throw new Error(`Process terminal runner exited before startup with code ${startup.code}: ${startup.stderr || startup.stdout}`);
    }
    return await resultPromise;
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
