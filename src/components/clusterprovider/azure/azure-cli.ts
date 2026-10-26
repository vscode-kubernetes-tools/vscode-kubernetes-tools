import * as nativeFs from 'fs';
import { mkdir } from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { FS } from '../../../fs';
import { monitorForAuthPrompt, Shell, ShellResult } from '../../../shell';
import * as processes from '../../../process';
import { ProcessResult } from '../../../process';
import { getUseWsl } from '../../config/config';

export interface AzureCliContext {
    readonly fs: FS;
    readonly shell: Shell;
}

interface AzureCliExecutable {
    readonly executable: string;
    readonly argsPrefix: readonly string[];
    readonly argv0?: string;
    readonly environment?: Readonly<Record<string, string>>;
}

export async function executeAzureCli(context: AzureCliContext, args: readonly string[]): Promise<ShellResult | undefined> {
    try {
        const execOpts = context.shell.execOpts();
        const cwd = execOpts.cwd ?? process.cwd();
        const executable = await resolveAzureCliExecutable(context, cwd, execOpts.env);
        if (!executable) {
            return undefined;
        }
        return await processes.executeCommand({
            executable: executable.executable,
            args: [...executable.argsPrefix, ...args],
            ...(executable.argv0 ? { argv0: executable.argv0 } : {}),
            cwd,
            env: executable.environment ? { ...(execOpts.env || process.env), ...executable.environment } : execOpts.env,
        }, undefined, monitorForAuthPrompt);
    } catch (err) {
        return { code: -1, stdout: '', stderr: err instanceof Error ? err.message : String(err) };
    }
}

export async function azureCliHome(context: AzureCliContext): Promise<string | undefined> {
    try {
        if (!getUseWsl()) {
            const home = context.shell.home();
            return path.isAbsolute(home) ? home : undefined;
        }
        const result = await executeWslUtility(context, ['/usr/bin/printenv', 'HOME']);
        return result?.code === 0 ? singleAbsoluteGuestPath(result.stdout) : undefined;
    } catch (_err) {
        return undefined;
    }
}

export async function ensureAzureCliDirectory(context: AzureCliContext, directory: string): Promise<string | undefined> {
    try {
        if (getUseWsl()) {
            if (!path.posix.isAbsolute(directory) || hasControlCharacters(directory)) {
                return 'The Azure CLI install directory is invalid.';
            }
            const result = await executeWslUtility(context, ['/usr/bin/mkdir', '-p', '--', directory]);
            return result && result.code === 0 ? undefined : result?.stderr || 'Unable to create the Azure CLI install directory.';
        }
        if (!path.isAbsolute(directory)) {
            return 'The Azure CLI install directory is invalid.';
        }
        await mkdir(directory, { recursive: true });
        return undefined;
    } catch (err) {
        return err instanceof Error ? err.message : String(err);
    }
}

async function resolveAzureCliExecutable(
    context: AzureCliContext,
    cwd: string | undefined,
    environment: NodeJS.ProcessEnv | undefined
): Promise<AzureCliExecutable | undefined> {
    const roots = workspaceRoots(cwd);
    if (getUseWsl()) {
        const wsl = windowsSystemExecutable(environment || process.env);
        if (!wsl) {
            return undefined;
        }
        const found = await executeWsl(wsl, ['/usr/bin/which', 'az'], cwd, environment);
        const alias = found.code === 0 ? singleAbsoluteGuestPath(found.stdout) : undefined;
        if (!alias) {
            return undefined;
        }
        const resolved = await executeWsl(wsl, ['/usr/bin/readlink', '-f', alias], cwd, environment);
        const target = resolved.code === 0 ? singleAbsoluteGuestPath(resolved.stdout) : undefined;
        const directoryResult = await executeWsl(wsl, ['/usr/bin/readlink', '-f', path.posix.dirname(alias)], cwd, environment);
        const targetDirectory = directoryResult.code === 0 ? singleAbsoluteGuestPath(directoryResult.stdout) : undefined;
        if (!target || !targetDirectory || !await isExecutableGuestPath(wsl, target, cwd, environment) ||
            !await isWslExecutableOutsideWorkspaces(wsl, alias, targetDirectory, target, roots, cwd, environment)) {
            return undefined;
        }
        const snap = await wslSnapAzureExecutable(wsl, alias, target, cwd, environment);
        if (snap === null) {
            return undefined;
        }
        const guest = snap || { executable: target, argsPrefix: [] };
        return { executable: wsl, argsPrefix: ['--exec', guest.executable, ...guest.argsPrefix] };
    }

    const alias = context.shell.which('az')?.trim();
    if (!alias || !path.isAbsolute(alias)) {
        return undefined;
    }
    const aliasDirectory = canonicalHostPath(path.dirname(alias));
    const canonicalAlias = canonicalHostPath(alias);
    if (!aliasDirectory || !canonicalAlias ||
        !trustedPathContains(environment || process.env, aliasDirectory, context.shell.isWindows())) {
        return undefined;
    }

    if (context.shell.isWindows() && /\.(?:cmd|bat)$/i.test(alias)) {
        const python = bundledAzurePython(alias);
        if (!python || !isTrustedHostExecutable(alias, aliasDirectory, [canonicalAlias, python.executable], roots)) {
            return undefined;
        }
        return {
            executable: python.executable,
            argsPrefix: ['-IBm', 'azure.cli'],
            ...(python.installer ? { environment: { AZ_INSTALLER: python.installer } } : {}),
        };
    }
    if (context.shell.isWindows() && path.extname(alias).toLowerCase() !== '.exe') {
        return undefined;
    }
    if (!isTrustedHostExecutable(alias, aliasDirectory, [canonicalAlias], roots)) {
        return undefined;
    }
    return { executable: canonicalAlias, argsPrefix: [], argv0: alias };
}

function bundledAzurePython(wrapper: string): { executable: string; installer?: string } | undefined {
    const candidates = [
        path.join(path.dirname(wrapper), '..', 'python.exe'),
        path.join(path.dirname(wrapper), 'python.exe'),
    ];
    for (const candidate of candidates) {
        const executable = canonicalHostPath(candidate);
        if (executable && path.extname(executable).toLowerCase() === '.exe' && nativeFs.statSync(executable).isFile()) {
            return { executable, installer: azureCliInstaller(wrapper) };
        }
    }
    return undefined;
}

function azureCliInstaller(wrapper: string): string | undefined {
    try {
        const match = /^\s*set\s+AZ_INSTALLER\s*=\s*(MSI|ZIP|PIP)\s*$/im.exec(nativeFs.readFileSync(wrapper, 'utf8'));
        return match?.[1].toUpperCase();
    } catch (_err) {
        return undefined;
    }
}

function isTrustedHostExecutable(
    alias: string,
    aliasDirectory: string,
    canonicalPaths: readonly string[],
    roots: readonly string[]
): boolean {
    const aliasPath = path.resolve(alias);
    for (const root of roots) {
        if (!path.isAbsolute(root)) {
            return false;
        }
        const lexicalWorkspace = path.resolve(root);
        if (isWithinHostPath(lexicalWorkspace, aliasPath)) {
            return false;
        }
        const workspace = canonicalHostPath(root);
        if (!workspace || workspace === path.parse(workspace).root ||
            isWithinHostPath(workspace, aliasDirectory) ||
            canonicalPaths.some((candidate) => isWithinHostPath(workspace, candidate))) {
            return false;
        }
    }
    return true;
}

async function isWslExecutableOutsideWorkspaces(
    wsl: string,
    alias: string,
    targetDirectory: string,
    target: string,
    roots: readonly string[],
    cwd: string | undefined,
    environment: NodeJS.ProcessEnv | undefined
): Promise<boolean> {
    for (const root of roots) {
        const workspace = await wslWorkspacePath(wsl, root, cwd, environment);
        if (!workspace) {
            return false;
        }
        const canonicalResult = await executeWsl(wsl, ['/usr/bin/readlink', '-f', workspace], cwd, environment);
        const canonicalWorkspace = canonicalResult.code === 0 ? singleAbsoluteGuestPath(canonicalResult.stdout) : undefined;
        if (!canonicalWorkspace || canonicalWorkspace === '/' ||
            isWithinPosixPath(workspace, alias) ||
            isWithinPosixPath(canonicalWorkspace, targetDirectory) ||
            isWithinPosixPath(canonicalWorkspace, target)) {
            return false;
        }
    }
    return true;
}

async function isExecutableGuestPath(
    wsl: string,
    file: string,
    cwd: string | undefined,
    environment: NodeJS.ProcessEnv | undefined
): Promise<boolean> {
    const result = await executeWsl(wsl, ['/usr/bin/test', '-x', file], cwd, environment);
    return result.code === 0;
}

async function wslSnapAzureExecutable(
    wsl: string,
    alias: string,
    target: string,
    cwd: string | undefined,
    environment: NodeJS.ProcessEnv | undefined
): Promise<{ executable: string; argsPrefix: string[] } | null | undefined> {
    if (target !== '/usr/bin/snap') {
        return undefined;
    }
    if (path.posix.dirname(alias) !== '/snap/bin') {
        return null;
    }
    const immediateResult = await executeWsl(wsl, ['/usr/bin/readlink', alias], cwd, environment);
    const immediate = singleLine(immediateResult.stdout);
    if (immediateResult.code !== 0 || !immediate) {
        return null;
    }

    let application: string;
    if (path.posix.isAbsolute(immediate)) {
        if (immediate !== '/usr/bin/snap') {
            return null;
        }
        application = path.posix.basename(alias);
    } else {
        if (!isSafeSnapApplication(immediate)) {
            return null;
        }
        const targetResult = await executeWsl(wsl, ['/usr/bin/readlink', '-f', `/snap/bin/${immediate}`], cwd, environment);
        if (targetResult.code !== 0 || singleAbsoluteGuestPath(targetResult.stdout) !== target) {
            return null;
        }
        application = immediate;
    }
    const snapResult = await executeWsl(wsl, ['/usr/bin/readlink', '-f', '/usr/bin/snap'], cwd, environment);
    if (snapResult.code !== 0 || singleAbsoluteGuestPath(snapResult.stdout) !== target ||
        !await isExecutableGuestPath(wsl, '/usr/bin/snap', cwd, environment)) {
        return null;
    }
    return { executable: '/usr/bin/snap', argsPrefix: ['run', '--', application] };
}

function isSafeSnapApplication(value: string): boolean {
    return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) && value !== '.' && value !== '..';
}

async function wslWorkspacePath(
    wsl: string,
    workspace: string,
    cwd: string | undefined,
    environment: NodeJS.ProcessEnv | undefined
): Promise<string | undefined> {
    if (path.posix.isAbsolute(workspace) && !hasControlCharacters(workspace)) {
        return workspace;
    }
    if (path.win32.isAbsolute(workspace)) {
        const result = await executeWsl(wsl, ['/usr/bin/wslpath', '-a', '-u', workspace], cwd, environment);
        return result.code === 0 ? singleAbsoluteGuestPath(result.stdout) : undefined;
    }
    return undefined;
}

async function executeWslUtility(context: AzureCliContext, args: readonly string[]): Promise<ProcessResult | undefined> {
    try {
        const execOpts = context.shell.execOpts();
        const wsl = windowsSystemExecutable(execOpts.env || process.env);
        return wsl ? await executeWsl(wsl, args, execOpts.cwd ?? process.cwd(), execOpts.env) : undefined;
    } catch (err) {
        return { code: -1, stdout: '', stderr: err instanceof Error ? err.message : String(err) };
    }
}

function executeWsl(
    wsl: string,
    args: readonly string[],
    cwd: string | undefined,
    environment: NodeJS.ProcessEnv | undefined
): Promise<ProcessResult> {
    return processes.executeCommand({
        executable: wsl,
        args: ['--exec', ...args],
        cwd,
        env: environment,
    });
}

function workspaceRoots(cwd?: string): string[] {
    return [...new Set([
        ...(cwd ? [cwd] : []),
        ...(vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.fsPath),
    ])];
}

function windowsSystemExecutable(environment: NodeJS.ProcessEnv): string | undefined {
    const key = Object.keys(environment).find((name) => name.toLowerCase() === 'systemroot') ||
        Object.keys(environment).find((name) => name.toLowerCase() === 'windir');
    const windowsDirectory = key ? environment[key] : undefined;
    return windowsDirectory && path.win32.isAbsolute(windowsDirectory) ?
        path.win32.join(windowsDirectory, 'System32', 'wsl.exe') :
        undefined;
}

function canonicalHostPath(value: string): string | undefined {
    try {
        return path.resolve(nativeFs.realpathSync.native(value));
    } catch (_err) {
        return undefined;
    }
}

function trustedPathContains(environment: NodeJS.ProcessEnv, directory: string, windows: boolean): boolean {
    const key = windows ? Object.keys(environment).find((name) => name.toLowerCase() === 'path') : 'PATH';
    return !!key && (environment[key] || '').split(path.delimiter).some((entry) =>
        entry.length > 0 && path.isAbsolute(entry) && path.dirname(entry) !== entry &&
        sameHostPath(canonicalHostPath(entry), directory)
    );
}

function sameHostPath(first: string | undefined, second: string): boolean {
    return !!first && hostPathComparisonKey(first) === hostPathComparisonKey(second);
}

function hostPathComparisonKey(value: string): string {
    return process.platform === 'win32' || process.platform === 'darwin' ? value.toLowerCase() : value;
}

function isWithinHostPath(parent: string, child: string): boolean {
    const relative = path.relative(hostPathComparisonKey(parent), hostPathComparisonKey(child));
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function isWithinPosixPath(parent: string, child: string): boolean {
    const relative = path.posix.relative(parent, child);
    return relative === '' || (relative !== '..' && !relative.startsWith('../') && !path.posix.isAbsolute(relative));
}

function singleAbsoluteGuestPath(output: string): string | undefined {
    const value = removeSingleTrailingNewline(output);
    return value.length > 0 && path.posix.isAbsolute(value) && !hasControlCharacters(value) ? value : undefined;
}

function singleLine(output: string): string | undefined {
    const value = removeSingleTrailingNewline(output);
    return value.length > 0 && !hasControlCharacters(value) ? value : undefined;
}

function removeSingleTrailingNewline(value: string): string {
    return value.endsWith('\r\n') ? value.slice(0, -2) : value.endsWith('\n') ? value.slice(0, -1) : value;
}

function hasControlCharacters(value: string): boolean {
    return /[\u0000-\u001f\u007f-\u009f]/.test(value);
}
