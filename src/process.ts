import { spawn } from 'child_process';
import type { ChildProcess, SpawnOptions } from 'child_process';

export interface CommandInvocation {
    readonly executable: string;
    readonly args: readonly string[];
    readonly argv0?: string;
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
}

export interface ProcessResult {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
    readonly signal?: NodeJS.Signals | null;
}

const MAX_BUFFER_BYTES = 20 * 1024 * 1024;

export interface ProcessExecutionOptions {
    readonly signal?: AbortSignal;
    readonly maxBufferBytes?: number;
    readonly captureOutput?: boolean;
    readonly onStdout?: (chunk: string) => void;
    readonly onStderr?: (chunk: string) => void;
    readonly pipeTo?: CommandInvocation;
}

export class ProcessExecutionError extends Error {
    constructor(
        readonly reason: 'cancelled' | 'invalid-executable' | 'output-limit' | 'spawn-failed' | 'execution-failed',
        message: string,
        readonly stdout = '',
        readonly stderr = '',
        readonly errorCode?: string
    ) {
        super(message);
    }
}

export function renderArgsForDisplay(args: readonly string[]): string {
    return args.map((arg) => JSON.stringify(arg)).join(' ');
}

export function spawnCommand(invocation: CommandInvocation): ChildProcess {
    const options: SpawnOptions = {
        argv0: invocation.argv0,
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
    onSpawn?: (process: ChildProcess) => void,
    options: ProcessExecutionOptions = {}
): Promise<ProcessResult> {
    return new Promise<ProcessResult>((resolve, reject) => {
        if (options.signal?.aborted) {
            reject(new ProcessExecutionError('cancelled', 'Command cancelled.'));
            return;
        }
        const children: ChildProcess[] = [];
        const stdout: string[] = [];
        const stderr: string[] = [];
        let failure: { reason: ProcessExecutionError['reason']; message: string; code?: string } | undefined;
        let killTimer: NodeJS.Timeout | undefined;
        let closed = 0;
        const exitCodes: number[] = [];
        let exitSignal: NodeJS.Signals | null = null;
        let settled = false;
        const captureOutput = options.captureOutput !== false;
        const maxBufferBytes = options.maxBufferBytes ?? MAX_BUFFER_BYTES;

        const fail = (reason: ProcessExecutionError['reason'], error: NodeJS.ErrnoException) => {
            if (failure || settled) {
                return;
            }
            failure = { reason, message: error.message, code: error.code };
            if (children.length === 0) {
                complete();
                return;
            }
            killTimer = setTimeout(() => {
                for (const child of children) {
                    if (child.exitCode === null && child.signalCode === null) {
                        child.kill('SIGKILL');
                    }
                }
            }, 1000);
            killTimer.unref();
            for (const child of children) {
                child.kill();
                child.stdout?.resume();
            }
        };
        const cancel = () => fail('cancelled', new Error('Command cancelled.'));

        const collectOutput = (stream: 'stdout' | 'stderr', chunks: string[], onData?: (chunk: string) => void) => {
            let bytes = 0;
            return (data: string) => {
                if (failure) {
                    return;
                }
                try {
                    if (captureOutput) {
                        bytes += Buffer.byteLength(data);
                        if (bytes > maxBufferBytes) {
                            fail('output-limit', new Error(`Process ${stream} exceeded the ${maxBufferBytes} byte limit.`));
                            return;
                        }
                        chunks.push(data);
                    }
                    onData?.(data);
                } catch (error) {
                    fail('execution-failed', error instanceof Error ? error : new Error(String(error)));
                }
            };
        };
        const collectStderr = collectOutput('stderr', stderr, options.onStderr);
        const complete = () => {
            settled = true;
            options.signal?.removeEventListener('abort', cancel);
            if (killTimer) {
                clearTimeout(killTimer);
            }
            const result = {
                code: exitSignal ? -1 : exitCodes[0] || exitCodes[1] || 0,
                stdout: stdout.join(''),
                stderr: stderr.join(''),
                signal: exitSignal,
            };
            if (failure) {
                reject(new ProcessExecutionError(failure.reason, failure.message, result.stdout, result.stderr, failure.code));
            } else {
                resolve(result);
            }
        };
        const track = (child: ChildProcess) => {
            const index = children.length;
            children.push(child);
            // Decode across chunk boundaries, including split UTF-8 characters.
            child.stderr?.setEncoding('utf8');
            child.stderr?.on('data', collectStderr);
            child.stdin?.on('error', (error: NodeJS.ErrnoException) => {
                if (error.code !== 'EPIPE') {
                    fail('execution-failed', error);
                }
            });
            child.once('error', (error: NodeJS.ErrnoException) => fail('spawn-failed', error));
            child.once('close', (code, signal) => {
                exitCodes[index] = code ?? -1;
                exitSignal = exitSignal || signal;
                closed++;
                if (closed === children.length) {
                    complete();
                }
            });
        };
        options.signal?.addEventListener('abort', cancel, { once: true });

        let childProcess: ChildProcess;
        try {
            childProcess = spawnCommand(invocation);
            track(childProcess);
            const output = options.pipeTo ? spawnCommand(options.pipeTo) : childProcess;
            if (output !== childProcess) {
                track(output);
                childProcess.stdout?.pipe(output.stdin!);
            }
            output.stdout?.setEncoding('utf8');
            output.stdout?.on('data', collectOutput('stdout', stdout, options.onStdout));
        } catch (error) {
            fail('spawn-failed', error instanceof Error ? error : new Error(String(error)));
            return;
        }
        try {
            childProcess.stdin?.end(stdin);
            onSpawn?.(childProcess);
        } catch (error) {
            fail('execution-failed', error instanceof Error ? error : new Error(String(error)));
        }
    });
}

export function executeCommandPiped(
    sourceInvocation: CommandInvocation,
    destinationInvocation: CommandInvocation,
    stdin?: string,
    onSourceSpawn?: (process: ChildProcess) => void,
    options: ProcessExecutionOptions = {}
): Promise<ProcessResult> {
    return executeCommand(sourceInvocation, stdin, onSourceSpawn, { ...options, pipeTo: destinationInvocation });
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
