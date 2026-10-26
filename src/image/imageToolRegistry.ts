import * as nativeFs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getImageBuildTool, getUseWsl } from '../components/config/config';
import { monitorForAuthPrompt, shell } from '../shell';
import * as processes from '../process';
import { CommandInvocation, ProcessResult } from '../process';
import { requireTaggedImageReference } from './imageReference';

export interface ImageToolExecutionOptions {
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
}

export interface ContainerImageBuildTool {
    readonly displayName: 'Docker' | 'Buildah';
    readonly binName: 'docker' | 'buildah';
    buildArgs(image: string): readonly string[];
    pushArgs(image: string): readonly string[];
    execute(args: readonly string[]): Promise<ProcessResult>;
}

interface ImageExecutionContext {
    readonly cwd: string;
    readonly env: NodeJS.ProcessEnv;
    readonly hostEnv: NodeJS.ProcessEnv;
    readonly envOverrides: NodeJS.ProcessEnv;
    readonly windows: boolean;
    readonly useWsl: boolean;
    readonly workspaceRoots: readonly string[];
}

interface ResolvedExecutable {
    readonly executable: string;
    readonly argv0?: string;
    readonly argsPrefix: readonly string[];
}

interface ImageToolDefinition {
    readonly displayName: 'Docker' | 'Buildah';
    readonly binName: 'docker' | 'buildah';
    readonly buildSubcommand: 'build' | 'bud';
}

const DEFINITIONS: Readonly<Record<'Docker' | 'Buildah', ImageToolDefinition>> = {
    Docker: { displayName: 'Docker', binName: 'docker', buildSubcommand: 'build' },
    Buildah: { displayName: 'Buildah', binName: 'buildah', buildSubcommand: 'bud' },
};

export async function getCurrentBuildTool(options: ImageToolExecutionOptions = {}): Promise<ContainerImageBuildTool> {
    if (!vscode.workspace.isTrusted) {
        throw new Error('Container image builds are disabled in untrusted workspaces.');
    }
    const configured = getImageBuildTool();
    if (configured !== 'Docker' && configured !== 'Buildah') {
        throw new Error(`Unknown image build tool: ${configured}. Choose the correct value in 'vs-kubernetes.imageBuildTool' setting.`);
    }
    const tool = await resolveImageTool(configured, options);
    if (!tool) {
        throw new Error(`Could not find ${DEFINITIONS[configured].binName} binary. Install it or choose another one in 'vs-kubernetes.imageBuildTool' setting.`);
    }
    return tool;
}

export async function resolveImageTool(
    kind: 'Docker' | 'Buildah',
    options: ImageToolExecutionOptions = {}
): Promise<ContainerImageBuildTool | undefined> {
    if (!vscode.workspace.isTrusted) {
        return undefined;
    }
    const definition = DEFINITIONS[kind];
    const context = executionContext(options);
    const resolved = context.useWsl ?
        await resolveWslExecutable(definition.binName, context) :
        resolveNativeExecutable(definition.binName, context);
    if (!resolved) {
        return undefined;
    }
    return {
        displayName: definition.displayName,
        binName: definition.binName,
        buildArgs(image: string): readonly string[] {
            requireTaggedImageReference(image);
            return [definition.buildSubcommand, '-t', image, '.'];
        },
        pushArgs(image: string): readonly string[] {
            requireTaggedImageReference(image);
            return ['push', image];
        },
        execute(args: readonly string[]): Promise<ProcessResult> {
            return processes.executeCommand(invocation(resolved, context, args), undefined, monitorForAuthPrompt);
        },
    };
}

function executionContext(options: ImageToolExecutionOptions): ImageExecutionContext {
    const execOpts = shell.execOpts();
    const cwd = options.cwd || execOpts.cwd || process.cwd();
    const useWsl = !!getUseWsl();
    if (!path.isAbsolute(cwd) && !(useWsl && path.win32.isAbsolute(cwd))) {
        throw new Error('The image build working directory must be absolute.');
    }
    const hostEnv = { ...(execOpts.env || process.env) };
    const launcherEnv = { ...hostEnv };
    const workspaceRoots = [...new Set([
        cwd,
        ...(vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.fsPath),
    ])];
    const envOverrides = sanitiseOverrides(options.env || {}, cwd, workspaceRoots);
    for (const [key, value] of Object.entries(envOverrides)) {
        const existing = Object.keys(hostEnv).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
        if (existing && existing !== key) {
            delete hostEnv[existing];
        }
        hostEnv[key] = value;
    }
    const env = sanitiseExecutionEnvironment(hostEnv, workspaceRoots, process.platform === 'win32');
    return {
        cwd,
        env,
        hostEnv: launcherEnv,
        envOverrides,
        windows: process.platform === 'win32',
        useWsl,
        workspaceRoots,
    };
}

function resolveNativeExecutable(name: string, context: ImageExecutionContext): ResolvedExecutable | undefined {
    const alias = firstExecutableOnPath(context.windows ? `${name}.exe` : name, context.env, context.windows);
    if (!alias || !path.isAbsolute(alias) || (context.windows && path.extname(alias).toLowerCase() !== '.exe')) {
        return undefined;
    }
    const executableDirectory = canonicalHostPath(path.dirname(alias));
    const executable = canonicalHostPath(alias);
    if (!executableDirectory || !executable || !nativeFs.statSync(executable).isFile() ||
        !trustedPathContains(context.env, executableDirectory, context.windows) ||
        !hostExecutableOutsideWorkspaces(alias, executableDirectory, executable, context.workspaceRoots)) {
        return undefined;
    }
    return { executable, argv0: alias, argsPrefix: [] };
}

async function resolveWslExecutable(name: string, context: ImageExecutionContext): Promise<ResolvedExecutable | undefined> {
    const wsl = windowsSystemExecutable(context.hostEnv);
    if (!wsl) {
        return undefined;
    }
    try {
        const found = await executeWsl(wsl, ['/usr/bin/which', name], context);
        const alias = found.code === 0 ? singleAbsoluteGuestPath(found.stdout) : undefined;
        if (!alias) {
            return undefined;
        }
        const resolved = await executeWsl(wsl, ['/usr/bin/readlink', '-f', alias], context);
        const executable = resolved.code === 0 ? singleAbsoluteGuestPath(resolved.stdout) : undefined;
        const directoryResult = await executeWsl(wsl, ['/usr/bin/readlink', '-f', path.posix.dirname(alias)], context);
        const executableDirectory = directoryResult.code === 0 ? singleAbsoluteGuestPath(directoryResult.stdout) : undefined;
        if (!executable || !executableDirectory ||
            !await isExecutableGuestPath(wsl, executable, context) ||
            !await wslExecutableOutsideWorkspaces(wsl, alias, executableDirectory, executable, context)) {
            return undefined;
        }
        const snap = await wslSnapExecutable(wsl, name, alias, executable, context);
        if (snap === null) {
            return undefined;
        }
        const guest = snap || { executable, argsPrefix: [] };
        return { executable: wsl, argsPrefix: ['--exec', guest.executable, ...guest.argsPrefix] };
    } catch (_err) {
        return undefined;
    }
}

function invocation(
    executable: ResolvedExecutable,
    context: ImageExecutionContext,
    args: readonly string[]
): CommandInvocation {
    const guestEnvironment = executable.argsPrefix[0] === '--exec' ? guestEnvironmentArgs(context.envOverrides) : [];
    const argsPrefix = guestEnvironment.length > 0 ?
        ['--exec', '/usr/bin/env', ...guestEnvironment, ...executable.argsPrefix.slice(1)] :
        executable.argsPrefix;
    return {
        executable: executable.executable,
        ...(executable.argv0 ? { argv0: executable.argv0 } : {}),
        args: [...argsPrefix, ...args],
        cwd: context.cwd,
        env: context.env,
    };
}

function firstExecutableOnPath(name: string, environment: NodeJS.ProcessEnv, windows: boolean): string | undefined {
    const key = windows ? Object.keys(environment).find((candidate) => candidate.toLowerCase() === 'path') : 'PATH';
    const pathValue = key ? environment[key] : undefined;
    if (!pathValue) {
        return undefined;
    }
    for (const entry of pathValue.split(path.delimiter)) {
        if (!entry || !path.isAbsolute(entry) || path.dirname(entry) === entry) {
            continue;
        }
        const candidate = path.join(entry, name);
        try {
            if (nativeFs.statSync(candidate).isFile()) {
                nativeFs.accessSync(candidate, nativeFs.constants.X_OK);
                return candidate;
            }
        } catch (_err) {
            // Continue to the next PATH entry.
        }
    }
    return undefined;
}

function sanitiseExecutionEnvironment(
    environment: NodeJS.ProcessEnv,
    workspaceRoots: readonly string[],
    windows: boolean
): NodeJS.ProcessEnv {
    const result: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(environment)) {
        const existing = Object.keys(result).find((candidate) => windows && candidate.toLowerCase() === key.toLowerCase());
        if (!existing) {
            result[key] = value;
        }
    }
    const pathKey = windows ? Object.keys(result).find((key) => key.toLowerCase() === 'path') : 'PATH';
    if (pathKey) {
        result[pathKey] = (result[pathKey] || '').split(path.delimiter).filter((entry) =>
            entry.length > 0 && path.isAbsolute(entry) && path.dirname(entry) !== entry &&
            !workspaceRoots.some((root) => isWorkspacePathEntry(root, entry))
        ).join(path.delimiter);
    }
    for (const key of Object.keys(result)) {
        if (key.toLowerCase() === 'docker_config' && result[key] &&
            workspaceRoots.some((root) => isWorkspacePathEntry(root, result[key]!))) {
            delete result[key];
        }
    }
    return result;
}

function isWorkspacePathEntry(root: string, entry: string): boolean {
    if (!path.isAbsolute(root)) {
        return true;
    }
    if (isWithinHostPath(path.resolve(root), path.resolve(entry))) {
        return true;
    }
    const workspace = canonicalHostPath(root);
    const pathEntry = canonicalHostPath(entry);
    return !workspace || workspace === path.parse(workspace).root || !pathEntry || isWithinHostPath(workspace, pathEntry);
}

function guestEnvironmentArgs(overrides: NodeJS.ProcessEnv): string[] {
    return Object.entries(overrides).flatMap(([key, value]) =>
        value !== undefined && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !hasControlCharacters(value) ?
            [`${key}=${value}`] : []
    );
}

function sanitiseOverrides(
    overrides: NodeJS.ProcessEnv,
    cwd: string,
    workspaceRoots: readonly string[]
): NodeJS.ProcessEnv {
    const result: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || hasControlCharacters(value)) {
            continue;
        }
        if (key.toLowerCase() === 'path') {
            result[key] = value.split(path.delimiter).filter((entry) =>
                entry.length > 0 && path.isAbsolute(entry) && path.dirname(entry) !== entry &&
                !workspaceRoots.some((root) => isWorkspacePathEntry(root, entry))
            ).join(path.delimiter);
            continue;
        }
        if (key.toLowerCase() === 'docker_config') {
            const configPath = path.isAbsolute(value) ? value : path.resolve(cwd, value);
            if (workspaceRoots.some((root) => isWorkspacePathEntry(root, configPath))) {
                continue;
            }
            result[key] = configPath;
            continue;
        }
        result[key] = value;
    }
    return result;
}

function hostExecutableOutsideWorkspaces(
    alias: string,
    executableDirectory: string,
    executable: string,
    roots: readonly string[]
): boolean {
    for (const root of roots) {
        if (!path.isAbsolute(root)) {
            return false;
        }
        if (isWithinHostPath(path.resolve(root), path.resolve(alias))) {
            return false;
        }
        const workspace = canonicalHostPath(root);
        if (!workspace || workspace === path.parse(workspace).root ||
            isWithinHostPath(workspace, executableDirectory) || isWithinHostPath(workspace, executable)) {
            return false;
        }
    }
    return true;
}

async function wslExecutableOutsideWorkspaces(
    wsl: string,
    alias: string,
    executableDirectory: string,
    executable: string,
    context: ImageExecutionContext
): Promise<boolean> {
    for (const root of context.workspaceRoots) {
        const workspace = await wslWorkspacePath(wsl, root, context);
        if (!workspace) {
            return false;
        }
        const canonicalResult = await executeWsl(wsl, ['/usr/bin/readlink', '-f', workspace], context);
        const canonicalWorkspace = canonicalResult.code === 0 ? singleAbsoluteGuestPath(canonicalResult.stdout) : undefined;
        if (!canonicalWorkspace || canonicalWorkspace === '/' ||
            isWithinPosixPath(workspace, alias) ||
            isWithinPosixPath(canonicalWorkspace, executableDirectory) ||
            isWithinPosixPath(canonicalWorkspace, executable)) {
            return false;
        }
    }
    return true;
}

async function wslWorkspacePath(wsl: string, workspace: string, context: ImageExecutionContext): Promise<string | undefined> {
    if (path.posix.isAbsolute(workspace) && !hasControlCharacters(workspace)) {
        return workspace;
    }
    if (path.win32.isAbsolute(workspace)) {
        const result = await executeWsl(wsl, ['/usr/bin/wslpath', '-a', '-u', workspace], context);
        return result.code === 0 ? singleAbsoluteGuestPath(result.stdout) : undefined;
    }
    return undefined;
}

async function wslSnapExecutable(
    wsl: string,
    name: string,
    alias: string,
    executable: string,
    context: ImageExecutionContext
): Promise<{ executable: string; argsPrefix: string[] } | null | undefined> {
    if (executable !== '/usr/bin/snap') {
        return undefined;
    }
    if (!['/snap/bin', '/var/lib/snapd/snap/bin'].includes(path.posix.dirname(alias))) {
        return null;
    }
    const immediate = await executeWsl(wsl, ['/usr/bin/readlink', alias], context);
    if (immediate.code !== 0 || removeSingleTrailingNewline(immediate.stdout) !== '/usr/bin/snap' ||
        !await isExecutableGuestPath(wsl, '/usr/bin/snap', context)) {
        return null;
    }
    return { executable: '/usr/bin/snap', argsPrefix: ['run', '--', name] };
}

async function isExecutableGuestPath(wsl: string, file: string, context: ImageExecutionContext): Promise<boolean> {
    const result = await executeWsl(wsl, ['/usr/bin/test', '-x', file], context);
    return result.code === 0;
}

function executeWsl(wsl: string, args: readonly string[], context: ImageExecutionContext): Promise<ProcessResult> {
    return processes.executeCommand({ executable: wsl, args: ['--exec', ...args], cwd: context.cwd, env: context.env });
}

function windowsSystemExecutable(environment: NodeJS.ProcessEnv): string | undefined {
    const key = Object.keys(environment).find((name) => name.toLowerCase() === 'systemroot') ||
        Object.keys(environment).find((name) => name.toLowerCase() === 'windir');
    const windowsDirectory = key ? environment[key] : undefined;
    return windowsDirectory && path.win32.isAbsolute(windowsDirectory) ?
        path.win32.join(windowsDirectory, 'System32', 'wsl.exe') : undefined;
}

function trustedPathContains(environment: NodeJS.ProcessEnv, directory: string, windows: boolean): boolean {
    const key = windows ? Object.keys(environment).find((name) => name.toLowerCase() === 'path') : 'PATH';
    return !!key && (environment[key] || '').split(path.delimiter).some((entry) =>
        entry.length > 0 && path.isAbsolute(entry) && path.dirname(entry) !== entry &&
        sameHostPath(canonicalHostPath(entry), directory)
    );
}

function canonicalHostPath(value: string): string | undefined {
    try {
        return path.resolve(nativeFs.realpathSync.native(value));
    } catch (_err) {
        return undefined;
    }
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

function removeSingleTrailingNewline(value: string): string {
    return value.endsWith('\r\n') ? value.slice(0, -2) : value.endsWith('\n') ? value.slice(0, -1) : value;
}

function hasControlCharacters(value: string): boolean {
    return /[\u0000-\u001f\u007f-\u009f]/.test(value);
}
