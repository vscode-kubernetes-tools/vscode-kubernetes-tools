import * as fs from 'fs';
import * as path from 'path';
import type { ChildProcess } from 'child_process';
import { execPath, isWindowsCommandScript } from '../../binutil';
import { CommandInvocation, executeCommand, ProcessResult } from '../../process';
import type { Shell } from '../../shell';

export type HelmCommandExecutor = typeof executeCommand;

export interface HelmExecutable {
    readonly path: string;
    readonly argv0?: string;
}

export function helmCommandInvocation(
    helm: HelmExecutable,
    args: readonly string[],
    shell: Shell,
    useWsl: boolean,
    cwdOverride?: string
): CommandInvocation {
    const execOpts = shell.execOpts();
    const cwd = cwdOverride || execOpts.cwd;
    if (useWsl) {
        const wsl = windowsSystemExecutable('wsl.exe', execOpts.env);
        if (!wsl || !path.posix.isAbsolute(helm.path)) {
            throw new Error('Unable to find a safe WSL Helm executable.');
        }
        return {
            executable: wsl,
            args: ['--exec', helm.path, ...args],
            cwd,
            env: execOpts.env,
        };
    }

    if (isWindowsCommandScript(shell, helm.path)) {
        throw new Error(`Configured Helm path '${helm.path}' is a command script; configure an .exe path for shell-free execution.`);
    }
    const executable = execPath(shell, helm.path);
    if (!path.isAbsolute(executable) && !(shell.isWindows() && path.win32.isAbsolute(executable))) {
        throw new Error(`Helm path '${helm.path}' is not absolute.`);
    }
    return {
        executable,
        ...(helm.argv0 ? { argv0: helm.argv0 } : {}),
        args: [...args],
        cwd,
        env: execOpts.env,
    };
}

export async function executeHelmCommand(
    helm: HelmExecutable,
    args: readonly string[],
    shell: Shell,
    useWsl: boolean,
    execute: HelmCommandExecutor = executeCommand,
    onSpawn?: (process: ChildProcess) => void,
    cwdOverride?: string
): Promise<ProcessResult> {
    return execute(helmCommandInvocation(helm, args, shell, useWsl, cwdOverride), undefined, onSpawn);
}

export async function helmPathForExecution(
    filePath: string,
    useWsl: boolean,
    execute: HelmCommandExecutor = executeCommand,
    environment: NodeJS.ProcessEnv = process.env
): Promise<string> {
    if (!useWsl || !isWindowsHostPath(filePath)) {
        return filePath;
    }
    if (isWslUncPath(filePath)) {
        throw new Error('Helm paths through a WSL UNC share are not supported; open the folder through the configured WSL environment.');
    }
    const wsl = windowsSystemExecutable('wsl.exe', environment);
    if (!wsl) {
        throw new Error('Unable to find the Windows system WSL executable.');
    }
    const result = await execute({
        executable: wsl,
        args: ['--exec', '/usr/bin/wslpath', '-a', '-u', filePath],
    });
    const converted = singleAbsoluteWslPath(result.stdout);
    if (result.code !== 0 || !converted) {
        throw new Error('Unable to convert the Helm path for WSL.');
    }
    return converted;
}

export function helmRelativePathForExecution(filePath: string, useWsl: boolean): string {
    return useWsl ? filePath.replace(/\\/g, '/') : filePath;
}

export async function resolveHelmExecutableForExecution(
    configuredExecutable: string | undefined,
    shell: Shell,
    useWsl: boolean,
    execute: HelmCommandExecutor = executeCommand,
    workspaceRoots: readonly string[] = []
): Promise<HelmExecutable | undefined> {
    const execOpts = shell.execOpts();
    const roots = uniqueWorkspaceRoots(execOpts.cwd, workspaceRoots);
    if (useWsl) {
        return resolveWslHelmExecutable(configuredExecutable, execOpts.cwd, execOpts.env, execute, roots);
    }
    if (configuredExecutable) {
        if (!fs.existsSync(configuredExecutable)) {
            return undefined;
        }
        return { path: configuredExecutable };
    }
    return resolveHostPathExecutable(shell, 'helm', execOpts.env, roots);
}

export function windowsSystemExecutable(filename: string, environment: NodeJS.ProcessEnv): string | undefined {
    const key = Object.keys(environment).find((name) => name.toLowerCase() === 'systemroot') ||
        Object.keys(environment).find((name) => name.toLowerCase() === 'windir');
    const windowsDirectory = key ? environment[key] : undefined;
    return windowsDirectory && path.win32.isAbsolute(windowsDirectory) ?
        path.win32.join(windowsDirectory, 'System32', filename) :
        undefined;
}

export function helmRepositoryCommandCwd(shell: Shell, useWsl: boolean): string | undefined {
    if (!useWsl && !shell.isWindows()) {
        return path.parse(process.cwd()).root;
    }
    const { env } = shell.execOpts();
    const wsl = windowsSystemExecutable('wsl.exe', env);
    return wsl ? path.win32.dirname(wsl) : undefined;
}

async function resolveWslHelmExecutable(
    configuredExecutable: string | undefined,
    cwd: string | undefined,
    environment: NodeJS.ProcessEnv,
    execute: HelmCommandExecutor,
    workspaceRoots: readonly string[]
): Promise<HelmExecutable | undefined> {
    const wsl = windowsSystemExecutable('wsl.exe', environment);
    if (!wsl) {
        return undefined;
    }
    if (configuredExecutable) {
        if (!path.posix.isAbsolute(configuredExecutable) || CONTROL_CHARACTERS.test(configuredExecutable)) {
            return undefined;
        }
        return await isExecutableWslPath(wsl, configuredExecutable, cwd, environment, execute) ?
            { path: configuredExecutable } : undefined;
    }

    const found = await executeWsl(wsl, ['/usr/bin/which', 'helm'], cwd, environment, execute);
    const alias = found.code === 0 ? singleAbsoluteWslPath(found.stdout) : undefined;
    if (!alias) {
        return undefined;
    }
    const resolved = await executeWsl(wsl, ['/usr/bin/readlink', '-f', alias], cwd, environment, execute);
    const executable = resolved.code === 0 ? singleAbsoluteWslPath(resolved.stdout) : undefined;
    if (!executable || !await isExecutableWslPath(wsl, executable, cwd, environment, execute)) {
        return undefined;
    }
    const resolvedDirectory = await executeWsl(wsl, ['/usr/bin/readlink', '-f', path.posix.dirname(alias)], cwd, environment, execute);
    const executableDirectory = resolvedDirectory.code === 0 ? singleAbsoluteWslPath(resolvedDirectory.stdout) : undefined;
    if (!executableDirectory) {
        return undefined;
    }

    for (const workspaceRoot of workspaceRoots) {
        const workspace = await wslWorkspacePath(wsl, workspaceRoot, cwd, environment, execute);
        if (!workspace) {
            throw new Error('A workspace path cannot be safely mapped into WSL.');
        }
        const canonicalWorkspaceResult = await executeWsl(wsl, ['/usr/bin/readlink', '-f', workspace], cwd, environment, execute);
        const canonicalWorkspace = canonicalWorkspaceResult.code === 0 ? singleAbsoluteWslPath(canonicalWorkspaceResult.stdout) : undefined;
        if (!canonicalWorkspace || canonicalWorkspace === '/' ||
            isWithinPosixPath(workspace, alias) || isWithinPosixPath(canonicalWorkspace, executableDirectory) ||
            isWithinPosixPath(canonicalWorkspace, executable)) {
            return undefined;
        }
    }
    return { path: executable };
}

async function wslWorkspacePath(
    wsl: string,
    workspaceRoot: string,
    cwd: string | undefined,
    environment: NodeJS.ProcessEnv,
    execute: HelmCommandExecutor
): Promise<string | undefined> {
    if (isWslUncPath(workspaceRoot)) {
        return undefined;
    }
    if (isWindowsHostPath(workspaceRoot)) {
        const result = await executeWsl(wsl, ['/usr/bin/wslpath', '-a', '-u', workspaceRoot], cwd, environment, execute);
        return result.code === 0 ? singleAbsoluteWslPath(result.stdout) : undefined;
    }
    return path.posix.isAbsolute(workspaceRoot) && !CONTROL_CHARACTERS.test(workspaceRoot) ? workspaceRoot : undefined;
}

async function isExecutableWslPath(
    wsl: string,
    executable: string,
    cwd: string | undefined,
    environment: NodeJS.ProcessEnv,
    execute: HelmCommandExecutor
): Promise<boolean> {
    const result = await executeWsl(wsl, ['/usr/bin/test', '-x', executable], cwd, environment, execute);
    return result.code === 0;
}

function executeWsl(
    wsl: string,
    args: readonly string[],
    cwd: string | undefined,
    environment: NodeJS.ProcessEnv,
    execute: HelmCommandExecutor
): Promise<ProcessResult> {
    return execute({ executable: wsl, args: ['--exec', ...args], cwd, env: environment });
}

function resolveHostPathExecutable(
    shell: Shell,
    name: string,
    environment: NodeJS.ProcessEnv,
    workspaceRoots: readonly string[]
): HelmExecutable | undefined {
    const alias = shell.which(process.platform === 'win32' ? `${name}.exe` : name)?.trim();
    if (!alias || !path.isAbsolute(alias)) {
        return undefined;
    }
    if (process.platform === 'win32' && path.extname(alias).toLowerCase() !== '.exe') {
        return undefined;
    }

    const executableDirectory = canonicalHostPath(path.dirname(alias));
    const executable = canonicalHostPath(alias);
    if (!executableDirectory || !executable) {
        return undefined;
    }
    const trustedPathEntry = environmentPath(environment)?.split(path.delimiter).some((entry) =>
        entry.length > 0 && path.isAbsolute(entry) && path.dirname(entry) !== entry &&
        canonicalHostPath(entry) === executableDirectory
    );
    if (!trustedPathEntry) {
        return undefined;
    }

    for (const workspaceRoot of workspaceRoots) {
        if (!path.isAbsolute(workspaceRoot)) {
            return undefined;
        }
        const lexicalWorkspace = path.resolve(workspaceRoot);
        if (isWithinHostPath(lexicalWorkspace, path.resolve(alias))) {
            return undefined;
        }
        const workspace = canonicalHostPath(workspaceRoot);
        if (!workspace || workspace === path.parse(workspace).root ||
            isWithinHostPath(workspace, executableDirectory) || isWithinHostPath(workspace, executable)) {
            return undefined;
        }
    }
    return { path: executable, argv0: alias };
}

function uniqueWorkspaceRoots(cwd: string | undefined, workspaceRoots: readonly string[]): string[] {
    return [...new Set([...(cwd ? [cwd] : []), ...workspaceRoots])];
}

function environmentPath(environment: NodeJS.ProcessEnv): string | undefined {
    if (process.platform !== 'win32') {
        return environment.PATH;
    }
    const key = Object.keys(environment).find((name) => name.toLowerCase() === 'path');
    return key ? environment[key] : undefined;
}

function canonicalHostPath(value: string): string | undefined {
    try {
        return path.resolve(fs.realpathSync.native(value));
    } catch (_err) {
        return undefined;
    }
}

function pathComparisonKey(value: string): string {
    return process.platform === 'win32' || process.platform === 'darwin' ? value.toLowerCase() : value;
}

function isWithinHostPath(parent: string, child: string): boolean {
    const relative = path.relative(pathComparisonKey(parent), pathComparisonKey(child));
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function isWithinPosixPath(parent: string, child: string): boolean {
    const relative = path.posix.relative(parent, child);
    return relative === '' || (relative !== '..' && !relative.startsWith('../') && !path.posix.isAbsolute(relative));
}

function singleAbsoluteWslPath(output: string): string | undefined {
    const lines = output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    const value = lines.length === 1 ? lines[0] : undefined;
    return value && path.posix.isAbsolute(value) && !CONTROL_CHARACTERS.test(value) ? value : undefined;
}

function isWindowsHostPath(filePath: string): boolean {
    return /^(?:[A-Za-z]:[\\/]|\\\\)/.test(filePath);
}

function isWslUncPath(filePath: string): boolean {
    return /^\\\\(?:wsl\$|wsl\.localhost)\\/i.test(filePath);
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
