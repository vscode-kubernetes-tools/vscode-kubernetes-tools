import { spawn as spawnChildProcess, spawnSync as spawnChildProcessSync } from 'child_process';
import type { ChildProcess, SpawnOptions } from 'child_process';

export type { ChildProcess };

export interface CommandInvocation {
    readonly executable: string;
    readonly args: readonly string[];
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
    readonly maxBufferBytes?: number;
}

export interface ProcessResult {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
}

export interface SyncProcessOptions {
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
    readonly stdio?: 'ignore' | 'pipe';
}

const DEFAULT_MAX_BUFFER_BYTES = 20 * 1024 * 1024;

export function renderCommandForDisplay(invocation: Pick<CommandInvocation, 'executable' | 'args'>): string {
    return [invocation.executable, ...invocation.args].map(renderArgumentForDisplay).join(' ');
}

export function renderArgsForDisplay(args: readonly string[]): string {
    return args.map(renderArgumentForDisplay).join(' ');
}

function renderArgumentForDisplay(value: string): string {
    return JSON.stringify(value);
}

export function spawnCommand(invocation: CommandInvocation): ChildProcess {
    const options: SpawnOptions = {
        cwd: invocation.cwd,
        env: invocation.env,
        shell: false,
        windowsHide: true,
    };
    return spawnChildProcess(invocation.executable, [...invocation.args], options);
}

export function executeCommandSync(executable: string, args: readonly string[], options: SyncProcessOptions = {}): ProcessResult {
    const result = spawnChildProcessSync(executable, [...args], {
        cwd: options.cwd,
        env: options.env,
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
        stdio: options.stdio || 'pipe',
    });
    if (result.error) {
        throw result.error;
    }
    return {
        code: result.status === null ? -1 : result.status,
        stdout: typeof result.stdout === 'string' ? result.stdout : '',
        stderr: typeof result.stderr === 'string' ? result.stderr : '',
    };
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
        const maxBufferBytes = invocation.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;
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
            if (stdoutBytes > maxBufferBytes) {
                fail(new Error(`Process stdout exceeded the ${maxBufferBytes} byte limit.`));
                return;
            }
            stdout.push(chunk);
        });
        childProcess.stderr?.on('data', (data: Buffer | string) => {
            const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
            stderrBytes += chunk.length;
            if (stderrBytes > maxBufferBytes) {
                fail(new Error(`Process stderr exceeded the ${maxBufferBytes} byte limit.`));
                return;
            }
            stderr.push(chunk);
        });
        childProcess.stdin?.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code !== 'EPIPE') {
                fail(error);
            }
        });
        childProcess.once('error', (error) => fail(error));
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
