import { spawn } from 'child_process';
import type { ChildProcess, SpawnOptions } from 'child_process';

export interface CommandInvocation {
    readonly executable: string;
    readonly args: readonly string[];
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
}

export interface ProcessResult {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
}

const MAX_BUFFER_BYTES = 20 * 1024 * 1024;

export function renderArgsForDisplay(args: readonly string[]): string {
    return args.map((arg) => JSON.stringify(arg)).join(' ');
}

export function spawnCommand(invocation: CommandInvocation): ChildProcess {
    const options: SpawnOptions = {
        cwd: invocation.cwd,
        env: invocation.env,
        shell: false,
        windowsHide: true,
    };
    return spawn(invocation.executable, [...invocation.args], options);
}

export function executeCommand(
    invocation: CommandInvocation,
    stdin?: string,
    onSpawn?: (process: ChildProcess) => void
): Promise<ProcessResult> {
    return new Promise<ProcessResult>((resolve, reject) => {
        const childProcess = spawnCommand(invocation);
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let stdoutBytes = 0;
        let stderrBytes = 0;
        let settled = false;

        const fail = (error: Error) => {
            if (settled) {
                return;
            }
            settled = true;
            childProcess.kill();
            reject(error);
        };

        childProcess.stdout?.on('data', (data: Buffer | string) => {
            const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
            stdoutBytes += chunk.length;
            if (stdoutBytes > MAX_BUFFER_BYTES) {
                fail(new Error(`Process stdout exceeded the ${MAX_BUFFER_BYTES} byte limit.`));
                return;
            }
            stdout.push(chunk);
        });
        childProcess.stderr?.on('data', (data: Buffer | string) => {
            const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
            stderrBytes += chunk.length;
            if (stderrBytes > MAX_BUFFER_BYTES) {
                fail(new Error(`Process stderr exceeded the ${MAX_BUFFER_BYTES} byte limit.`));
                return;
            }
            stderr.push(chunk);
        });
        childProcess.stdin?.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code !== 'EPIPE') {
                fail(error);
            }
        });
        childProcess.once('error', fail);
        childProcess.once('close', (code) => {
            if (settled) {
                return;
            }
            settled = true;
            resolve({
                code: code === null ? -1 : code,
                stdout: Buffer.concat(stdout).toString('utf8'),
                stderr: Buffer.concat(stderr).toString('utf8'),
            });
        });

        if (stdin !== undefined && childProcess.stdin) {
            childProcess.stdin.end(stdin);
        } else {
            childProcess.stdin?.end();
        }
        onSpawn?.(childProcess);
    });
}

export function executeCommandPiped(
    sourceInvocation: CommandInvocation,
    destinationInvocation: CommandInvocation,
    stdin?: string,
    onSourceSpawn?: (process: ChildProcess) => void
): Promise<ProcessResult> {
    return new Promise<ProcessResult>((resolve, reject) => {
        const source = spawnCommand(sourceInvocation);
        const destination = spawnCommand(destinationInvocation);
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let outputBytes = 0;
        let sourceCode: number | undefined;
        let destinationCode: number | undefined;
        let settled = false;

        const fail = (error: Error) => {
            if (settled) {
                return;
            }
            settled = true;
            source.kill();
            destination.kill();
            reject(error);
        };
        const collect = (target: Buffer[], data: Buffer | string) => {
            const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
            outputBytes += chunk.length;
            if (outputBytes > MAX_BUFFER_BYTES) {
                fail(new Error(`Process output exceeded the ${MAX_BUFFER_BYTES} byte limit.`));
                return;
            }
            target.push(chunk);
        };
        const complete = () => {
            if (settled || sourceCode === undefined || destinationCode === undefined) {
                return;
            }
            settled = true;
            resolve({
                code: sourceCode || destinationCode || 0,
                stdout: Buffer.concat(stdout).toString('utf8'),
                stderr: Buffer.concat(stderr).toString('utf8'),
            });
        };

        source.stdout?.pipe(destination.stdin!);
        destination.stdin?.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code !== 'EPIPE') {
                fail(error);
            }
        });
        source.stderr?.on('data', (data) => collect(stderr, data));
        destination.stdout?.on('data', (data) => collect(stdout, data));
        destination.stderr?.on('data', (data) => collect(stderr, data));
        source.once('error', fail);
        destination.once('error', fail);
        source.once('close', (code) => {
            sourceCode = code === null ? -1 : code;
            complete();
        });
        destination.once('close', (code) => {
            destinationCode = code === null ? -1 : code;
            complete();
        });
        source.stdin?.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code !== 'EPIPE') {
                fail(error);
            }
        });
        if (stdin !== undefined && source.stdin) {
            source.stdin.end(stdin);
        } else {
            source.stdin?.end();
        }
        onSourceSpawn?.(source);
    });
}

export function snapPipeInvocation(
    invocation: CommandInvocation,
    useWsl: boolean
): CommandInvocation {
    return useWsl ? {
        executable: 'wsl.exe',
        args: ['--exec', 'cat'],
        cwd: invocation.cwd,
        env: invocation.env,
    } : {
        executable: 'cat',
        args: [],
        cwd: invocation.cwd,
        env: invocation.env,
    };
}
