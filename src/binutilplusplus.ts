import * as rx from 'rxjs';
import * as spawnrx from 'spawn-rx';
import { ChildProcess, spawn as spawnChildProcess } from "child_process";
import { Host } from './host';
import { FS } from './fs';
import { Shell } from './shell';
import { installDependencies } from "./components/installer/installdependencies";
import { getToolPath, getUseWsl } from './components/config/config';
import { Errorable } from './errorable';
import { parseLineOutput } from './outputUtils';
import { Dictionary } from './utils/dictionary';

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
export type BackgroundExecResult = ExecBinNotFound | ExecChildProcessStarted;

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
    if (context.status && context.status.found && context.status.how === 'config') {
        return context.status.where!;
    }
    return context.binary.binBaseName;
}

async function baseBinPath(context: Context): Promise<string> {
    let binPath = await unquotedBaseBinPath(context);
    if (binPath && binPath.includes(' ')) {
        binPath = `"${binPath}"`;
    }
    return binPath;
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
            const sr = await context.shell.exec(`ls ${configuredPath}`);
            const found = (!!sr && sr.code === 0);
            return { found, how: 'config', where: configuredPath };
        } else {
            const found = await context.fs.existsAsync(configuredPath);
            return { found, how: 'config', where: configuredPath };
        }
    }

    // No config so look on the system PATH
    const cmd = context.shell.isWindows() ? `where.exe ${context.binary.binBaseName}.exe` : `which ${context.binary.binBaseName}`;

    const opts = {
        async: true,
        env: {
            HOME: process.env.HOME,
            PATH: process.env.PATH
        }
    };

    const execResult = await context.shell.execCore(cmd, opts);
    if (execResult.code !== 0) {
        return { found: false, how: 'path' };
    }

    return { found: true, how: 'path', where: execResult.stdout };
}

// This is silent - building block for experiences that need an input->output invoke
export async function invokeForResult(context: Context, command: string, stdin: string | undefined): Promise<ExecResult> {
    const fbr = await findBinary(context);
    if (!fbr.found) {
        return { resultKind: 'exec-bin-not-found', execProgram: context.binary, command, findResult: fbr };
    }

    const bin = await baseBinPath(context);
    const cmd = `${bin} ${command}`;
    const sr = await context.shell.exec(cmd, stdin);

    if (!sr) {
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

export async function invokeTracking(context: Context, args: string[]): Promise<RunningProcess> {
    const linesSubject = new rx.Subject<string>();

    const fbr = await findBinary(context);
    if (!fbr.found) {
        linesSubject.error({ resultKind: 'exec-bin-not-found', execProgram: context.binary, command: args.join(' '), findResult: fbr });
    }

    const bin = await baseBinPath(context);

    let pending = '';
    const stdout = spawnrx.spawn(bin, args);
    stdout.subscribe((chunk) => {
        const todo = pending + chunk;
        const lines = todo.split('\n').map((l) => l.trim());
        const lastIsWholeLine = todo.endsWith('\n');
        pending = lastIsWholeLine ? '' : lines.pop()!;
        for (const line of lines) {
            linesSubject.next(line);
        }
    });
    return { lines: linesSubject, terminate: () => linesSubject.unsubscribe() };
}

export async function invokeBackground(context: Context, args: string[]): Promise<BackgroundExecResult> {
    const fbr = await findBinary(context);
    if (!fbr.found) {
        return { resultKind: 'exec-bin-not-found', execProgram: context.binary, command: args.join(' '), findResult: fbr };
    }

    const bin = await baseBinPath(context);

    const childProcess = spawnChildProcess(bin, args, context.shell.execOpts());
    return { resultKind: 'exec-child-process-started', execProgram: context.binary, command: args.join(' '), childProcess };
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
            installDependencies();
            break;
    }
}

async function showErrorMessageWithInstallPromptForConfiguredBinPath(context: Context, message: string) {
    const choice = await context.host.showErrorMessage(message, 'Install dependencies');
    if (choice === 'Install dependencies') {
        installDependencies();
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
