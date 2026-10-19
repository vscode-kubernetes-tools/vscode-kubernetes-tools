import * as rx from 'rxjs';
import type { ChildProcess } from "./process";
import { Host } from './host';
import { FS } from './fs';
import { monitorForAuthPrompt, Shell } from './shell';
import { getToolPath, getUseWsl } from './components/config/config';
import { Errorable } from './errorable';
import { parseLineOutput } from './outputUtils';
import { Dictionary } from './utils/dictionary';
import { CommandInvocation, executeCommand, renderArgsForDisplay, spawnCommand } from './process';
import { execPath } from './binutil';

export interface ExternalBinary {
    readonly displayName: string;
    readonly binBaseName: string;
    readonly configKeyName: string;
    readonly offersInstall: boolean;
}

export interface ExecBinNotFound {
    readonly resultKind: 'exec-bin-not-found';
    readonly execProgram: ExternalBinary;
    readonly command: string;
    readonly findResult: FindBinaryStatus;
}

export interface ExecFailed {
    readonly resultKind: 'exec-failed';
    readonly execProgram: ExternalBinary;
    readonly command: string;
}

export interface ExecSucceeded {
    readonly resultKind: 'exec-succeeded';
    readonly execProgram: ExternalBinary;
    readonly command: string;
    readonly stdout: string;
}

export interface ParsedExecSucceeded<T> {
    readonly resultKind: 'exec-succeeded';
    readonly execProgram: ExternalBinary;
    readonly command: string;
    readonly result: T;
}

export interface ExecErrored {
    readonly resultKind: 'exec-errored';
    readonly execProgram: ExternalBinary;
    readonly command: string;
    readonly code: number;
    readonly stderr: string;
}


export interface ExecChildProcessStarted {
    readonly resultKind: 'exec-child-process-started';
    readonly execProgram: ExternalBinary;
    readonly command: string;
    readonly childProcess: ChildProcess;
}

export type ParsedExecResult<T> = ExecBinNotFound | ExecFailed | ParsedExecSucceeded<T> | ExecErrored;
export type ExecResult = ExecBinNotFound | ExecFailed | ExecSucceeded | ExecErrored;
export type FailedExecResult = ExecBinNotFound | ExecFailed | ExecErrored;
export type BackgroundExecResult = ExecBinNotFound | ExecFailed | ExecChildProcessStarted;

export interface FailureMessageOptions {
    readonly whatFailed?: string;
}

export namespace ExecResult {
    export function tryMap<T>(execResult: ExecResult, fn: (output: string) => T): Errorable<T> {
        if (execResult.resultKind === 'exec-bin-not-found') {
            return { succeeded: false, error: [`${execResult.execProgram.displayName} command failed trying to run '${execResult.command}': ${execResult.execProgram.binBaseName} not found`] };
        }
        if (execResult.resultKind === 'exec-failed') {
            return { succeeded: false, error: [`${execResult.execProgram.displayName} command failed trying to run '${execResult.command}': unable to run ${execResult.execProgram.binBaseName}`] };
        }

        if (execResult.resultKind === 'exec-succeeded') {
            return { succeeded: true, result: fn(execResult.stdout.trim()) };
        }

        return { succeeded: false, error: [ execResult.stderr ] };
    }

    export function map<T>(execResult: ExecResult, fn: (output: string) => T): ParsedExecResult<T> {
        if (ExecResult.failed(execResult)) {
            return execResult;
        }

        return {
            resultKind: execResult.resultKind,
            execProgram: execResult.execProgram,
            command: execResult.command,
            result: fn(execResult.stdout.trim())
        };
    }

    export function failureMessage(execResult: FailedExecResult, options: FailureMessageOptions): string {
        const err = ExecResult.tryMap(execResult, (s) => s);
        if (Errorable.failed(err)) {
            const prefix = options.whatFailed ?
                `${options.whatFailed}: ` :
                '';
            return prefix + err.error[0];
        }
        return '';
    }

    export function failed<T>(execResult: ExecResult | ParsedExecResult<T>): execResult is FailedExecResult {
        return execResult.resultKind !== 'exec-succeeded';
    }

    export function succeeded(execResult: ExecResult): execResult is ExecSucceeded {
        return execResult.resultKind === 'exec-succeeded';
    }

    export function asErrorable<T>(execResult: ParsedExecResult<T>, options: FailureMessageOptions): Errorable<T> {
        if (failed(execResult)) {
            return { succeeded: false, error: [failureMessage(execResult, options)] };
        }
        return { succeeded: true, result: execResult.result };
    }
}

export interface BinaryFound {
    readonly found: true;
    readonly how: 'config' | 'path';
    readonly where: string;
}

export interface BinaryPathfinderProvided {
    readonly found: true;
    readonly how: 'pathfinder';
}

export interface ConfiguredBinaryNotFound {
    readonly found: false;
    readonly how: 'config';
    readonly where: string;
}

export interface UnconfiguredBinaryNotFound {
    readonly found: false;
    readonly how: 'path';
}

export type FindBinaryStatus = BinaryFound | BinaryPathfinderProvided | ConfiguredBinaryNotFound | UnconfiguredBinaryNotFound;

export interface Context {
    readonly host: Host;
    readonly fs: FS;
    readonly shell: Shell;
    readonly pathfinder: (() => Promise<string>) | undefined;
    readonly binary: ExternalBinary;
    status: FindBinaryStatus | undefined;
}

async function unquotedBaseBinPath(context: Context): Promise<string> {
    if (context.pathfinder) {
        return await context.pathfinder();
    }
    if (context.status && context.status.found && context.status.how !== 'pathfinder') {
        return context.status.where;
    }
    return context.binary.binBaseName;
}

async function executeUtility(context: Context, executable: string, args: readonly string[]) {
    const execOpts = context.shell.execOpts();
    return await executeCommand({
        executable,
        args: [...args],
        cwd: execOpts.cwd,
        env: execOpts.env,
    });
}

export async function commandInvocation(context: Context, args: readonly string[]): Promise<CommandInvocation> {
    const configuredExecutable = await unquotedBaseBinPath(context);
    const execOpts = context.shell.execOpts();
    if (getUseWsl()) {
        return {
            executable: 'wsl.exe',
            args: ['--exec', configuredExecutable, ...args],
            cwd: execOpts.cwd,
            env: execOpts.env,
        };
    }
    return {
        executable: execPath(context.shell, configuredExecutable),
        args: [...args],
        cwd: execOpts.cwd,
        env: execOpts.env,
    };
}

// This is silent - just caching over findBinaryCore
export async function findBinary(context: Context): Promise<FindBinaryStatus> {
    if (context.status && context.status.found) {
        return context.status;
    }

    const fbr = await findBinaryCore(context);

    context.status = fbr;

    return fbr;
}

// This is silent: tells us whether we can find the required binary
async function findBinaryCore(context: Context): Promise<FindBinaryStatus> {
    if (context.pathfinder) {
        return { found: true, how: 'pathfinder' };
    }

    // Do we have a configured location?
    const configuredPath = getToolPath(context.host, context.shell, context.binary.configKeyName);
    if (configuredPath) {
        // Does the file exist?
        if (getUseWsl()) {
            let found = false;
            try {
                const sr = await executeUtility(context, 'wsl.exe', ['--exec', 'test', '-e', configuredPath]);
                found = sr.code === 0;
            } catch (_err) {
                found = false;
            }
            return { found, how: 'config', where: configuredPath };
        } else {
            const found = await context.fs.existsAsync(configuredPath);
            return { found, how: 'config', where: configuredPath };
        }
    }

    // No config so look on the system PATH
    let executable = 'which';
    let args = [context.binary.binBaseName];
    if (getUseWsl()) {
        executable = 'wsl.exe';
        args = ['--exec', 'which', context.binary.binBaseName];
    } else if (context.shell.isWindows()) {
        executable = 'where.exe';
        args = [context.binary.binBaseName];
    }

    let execResult;
    try {
        execResult = await executeUtility(context, executable, args);
    } catch (_err) {
        return { found: false, how: 'path' };
    }
    if (execResult.code !== 0) {
        return { found: false, how: 'path' };
    }

    const resolvedPath = execResult.stdout.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() || '';
    return resolvedPath ? { found: true, how: 'path', where: resolvedPath } : { found: false, how: 'path' };
}

// This is silent - building block for experiences that need an input->output invoke
export async function invokeForResult(context: Context, args: readonly string[], stdin: string | undefined): Promise<ExecResult> {
    const command = renderArgsForDisplay(args);
    const fbr = await findBinary(context);
    if (!fbr.found) {
        return { resultKind: 'exec-bin-not-found', execProgram: context.binary, command, findResult: fbr };
    }

    let sr;
    try {
        const invocation = await commandInvocation(context, args);
        sr = await executeCommand(invocation, stdin, monitorForAuthPrompt);
    } catch (_err) {
        return { resultKind: 'exec-failed', execProgram: context.binary, command };
    }

    if (sr.code === 0) {
        return { resultKind: 'exec-succeeded', execProgram: context.binary, command, stdout: sr.stdout };
    }

    return { resultKind: 'exec-errored', execProgram: context.binary, command, code: sr.code, stderr: sr.stderr };
}

export interface RunningProcess {
    readonly lines: rx.Observable<string>;
    terminate(): void;
}

export async function invokeTracking(context: Context, args: readonly string[]): Promise<RunningProcess> {
    const linesSubject = new rx.Subject<string>();

    const fbr = await findBinary(context);
    let disposer: () => void;

    if (fbr.found) {
        const invocation = await commandInvocation(context, args);

        let pending = '';
        let terminated = false;
        const childProcess = spawnCommand(invocation);
        monitorForAuthPrompt(childProcess);
        childProcess.stdout?.on('data', (chunk: Buffer) => {
            const chunkText = chunk.toString('utf8');
            const todo = pending + chunkText;
            const lines = todo.split('\n').map((l) => l.trim());
            const lastIsWholeLine = todo.endsWith('\n');
            pending = lastIsWholeLine ? '' : lines.pop()!;
            for (const line of lines) {
                linesSubject.next(line);
            }
        });
        childProcess.on('error', (err: Error) => {
            if (!terminated) {
                linesSubject.error(err);
            }
        });
        childProcess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
            if (terminated) {
                linesSubject.complete();
                return;
            }
            if (code === 0) {
                linesSubject.complete();
            } else {
                const message = `Process ${JSON.stringify(invocation.executable)} exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`;
                linesSubject.error(new Error(message));
            }
        });
        disposer = () => {
            terminated = true;
            childProcess.kill();
        };
    } else {
        linesSubject.error({ resultKind: 'exec-bin-not-found', execProgram: context.binary, command: renderArgsForDisplay(args), findResult: fbr });
    }

    return { lines: linesSubject, terminate: () => {
            if (disposer) {
                disposer();
            }
        }
    };
}

export async function invokeBackground(context: Context, args: readonly string[]): Promise<BackgroundExecResult> {
    const fbr = await findBinary(context);
    if (!fbr.found) {
        return { resultKind: 'exec-bin-not-found', execProgram: context.binary, command: renderArgsForDisplay(args), findResult: fbr };
    }

    const invocation = await commandInvocation(context, args);
    const childProcess = spawnCommand(invocation);
    try {
        await waitForSpawn(childProcess);
    } catch (_err) {
        return { resultKind: 'exec-failed', execProgram: context.binary, command: renderArgsForDisplay(args) };
    }
    // Callers own lifecycle errors after a successful spawn; keep EventEmitter errors handled.
    childProcess.on('error', () => {});
    monitorForAuthPrompt(childProcess);
    return { resultKind: 'exec-child-process-started', execProgram: context.binary, command: renderArgsForDisplay(args), childProcess };
}

function waitForSpawn(childProcess: ChildProcess): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const onSpawn = () => {
            childProcess.removeListener('error', onError);
            resolve();
        };
        const onError = (error: Error) => {
            childProcess.removeListener('spawn', onSpawn);
            reject(error);
        };
        childProcess.once('spawn', onSpawn);
        childProcess.once('error', onError);
    });
}

// This is noisy - handles failure UI for an interactive command that performs an invokeForResult
export async function discardFailureInteractive(context: Context, result: ExecResult, options: FailureMessageOptions): Promise<ExecSucceeded | undefined> {
    const prefix = options.whatFailed ?
        `${options.whatFailed}: ` :
        '';
    const announcement = `${prefix}${result.execProgram.displayName} command failed`;
    switch (result.resultKind) {
        case 'exec-bin-not-found':
            await showErrorMessageWithInstallPrompt(context, result.findResult, `${announcement}: ${result.execProgram.binBaseName} not found`);
            return undefined;
        case 'exec-failed':
            await context.host.showErrorMessage(`${announcement}: unable to run ${result.execProgram.binBaseName}`);
            return undefined;
        case 'exec-errored':
            await context.host.showErrorMessage(`${announcement}: ${result.stderr}`);
            return undefined;
        case 'exec-succeeded':
            return result;
    }
}

export async function showErrorMessageWithInstallPrompt(context: Context, findResult: FindBinaryStatus, message: string): Promise<void> {
    const binary = context.binary;
    switch (findResult.how) {
        case 'path':
            return showErrorMessageWithInstallPromptForSystemPath(context, message, binary);
        case 'config':
            return showErrorMessageWithInstallPromptForConfiguredBinPath(context, message);
    }
}

async function showErrorMessageWithInstallPromptForSystemPath(context: Context, message: string, binary: ExternalBinary) {
    const choice = await context.host.showErrorMessage(message, 'Install dependencies', 'Learn more');
    switch (choice) {
        case 'Learn more':
            context.host.showInformationMessage(`Add '${binary.binBaseName}' directory to path, or set "vs-kubernetes.${binary.configKeyName}-path" config to ${binary.binBaseName} binary.`);
            break;
        case 'Install dependencies':
            void import('./components/installer/installdependencies').then((installer) => installer.installDependencies());
            break;
    }
}

async function showErrorMessageWithInstallPromptForConfiguredBinPath(context: Context, message: string) {
    const choice = await context.host.showErrorMessage(message, 'Install dependencies');
    if (choice === 'Install dependencies') {
        void import('./components/installer/installdependencies').then((installer) => installer.installDependencies());
    }
}

export function logText(context: Context, execResult: ExecResult): string {
    switch (execResult.resultKind) {
        case 'exec-bin-not-found':
            return `*** ${context.binary.binBaseName} binary not found (using ${context.status ? context.status.how : '(unknown strategy)'})`;
        case 'exec-failed':
            return `*** failed to invoke ${context.binary.binBaseName} (from ${context.status ? (context.status.how === 'config' ? context.status.where : 'path') : '(unknown strategy)'}`;
        case 'exec-errored':
            return `${context.binary.binBaseName} exited with code ${execResult.code}\n${execResult.stderr}`;
        case 'exec-succeeded':
            return '';
    }
}

export function parseJSON<T>(execResult: ExecResult): Errorable<T> {
    return ExecResult.tryMap<T>(execResult, (text) => JSON.parse(text) as T);
}

export function parseTable(execResult: ExecResult, columnSeparator: RegExp): Errorable<Dictionary<string>[]> {
    return ExecResult.tryMap<Dictionary<string>[]>(execResult, (text) => parseLinedText(text, columnSeparator));
}

export function parseLinedText(text: string, columnSeparator: RegExp): Dictionary<string>[] {
    const lines = text.split('\n').filter((l) => l.length > 0);
    const parsedOutput = parseLineOutput(lines, columnSeparator);
    return parsedOutput;

}
