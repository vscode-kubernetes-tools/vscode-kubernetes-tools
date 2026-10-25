'use strict';

import * as vscode from 'vscode';
import * as nativeFs from 'fs';
import * as path from 'path';
import { Shell } from '../../../shell';
import { Host } from '../../../host';
import { FS } from '../../../fs';
import { Errorable, failed } from '../../../errorable';
import { fromShellExitCodeOnly, Diagnostic } from '../../../wizard';
import { getCheckForMinikubeUpgrade, getToolPath, getUseWsl, setMinikubeShowInfo } from '../../config/config';
import { installMinikube } from '../../installer/installer';
import { isMinikubeInfoDisplay, ShowInformationOptions } from '../common/cacheinfo';
import * as processes from '../../../process';
import { ProcessResult } from '../../../process';
import { minikubeLifecycleArgs, minikubeStartCommand, MinikubeStartOptions } from './commands';

export interface MinikubeInfo {
    readonly running: boolean;
    readonly message: string;
}

export interface MinikubeVersionInfo {
    readonly currentVersion: string;
    readonly availableVersion: string;
}

export type MinikubeOptions = MinikubeStartOptions;

export interface Minikube {
    checkPresent(mode: CheckPresentMode): Promise<boolean>;
    checkUpgradeAvailable(): Promise<void>;
    invokeCommand(args: readonly string[]): Promise<ProcessResult | undefined>;
    isRunnable(): Promise<Errorable<Diagnostic>>;
    start(options: MinikubeOptions): Promise<boolean>;
    stop(): Promise<void>;
    status(): Promise<MinikubeInfo>;
}

export function create(host: Host, fs: FS, shell: Shell): Minikube {
    return new MinikubeImpl(host, fs, shell, false);
}

export function createOnBinary(host: Host, fs: FS, shell: Shell, bin: string): Minikube {
    return new MinikubeImpl(host, fs, shell, true, bin);
}

// TODO: these are the same as we are using for kubectl -
// we really need to unify them (and the designs).

export enum CheckPresentMode {
    Alert,
    Silent
}

interface Context {
    readonly host: Host;
    readonly fs: FS;
    readonly shell: Shell;
    readonly fixedBinary: boolean;
    readonly fixedPath?: string;
    readonly fixedUseWsl?: boolean;
}

interface MinikubeExecutionContext {
    readonly useWsl: boolean;
    readonly windows: boolean;
    readonly cwd: string;
    readonly environment: NodeJS.ProcessEnv | undefined;
    readonly workspaceRoots: readonly string[];
    readonly wsl?: string;
}

interface MinikubeResolution extends MinikubeExecutionContext {
    readonly path: string;
    readonly argv0?: string;
}

class MinikubeImpl implements Minikube {
    private readonly context: Context;
    private readonly activeProfiles = new Map<boolean, { readonly profile?: string }>();

    constructor(host: Host, fs: FS, shell: Shell, toolFound: boolean, binPath = 'minikube') {
        this.context = {
            host,
            fs,
            shell,
            fixedBinary: toolFound,
            fixedPath: toolFound ? binPath : undefined,
            fixedUseWsl: toolFound ? !!getUseWsl() : undefined,
        };
    }

    checkPresent(mode: CheckPresentMode): Promise<boolean> {
        return checkPresent(this.context, mode);
    }

    isRunnable(): Promise<Errorable<Diagnostic>> {
        return isRunnableMinikube(this.context);
    }

    invokeCommand(args: readonly string[]): Promise<ProcessResult | undefined> {
        return invokeMinikubeCommand(this.context, args);
    }

    async start(options: MinikubeOptions): Promise<boolean> {
        const started = await startMinikube(this.context, options);
        if (started.accepted) {
            this.activeProfiles.set(started.useWsl, { profile: started.profile });
        }
        return started.accepted;
    }

    async stop(): Promise<void> {
        const profile = this.profileForCurrentMode();
        if (profile === null) {
            throw new Error('The Minikube execution mode changed after the cluster was started.');
        }
        return stopMinikube(this.context, profile);
    }

    async status(): Promise<MinikubeInfo> {
        const profile = this.profileForCurrentMode();
        if (profile === null) {
            throw new Error('The Minikube execution mode changed after the cluster was started.');
        }
        return minikubeStatus(this.context, profile);
    }

    checkUpgradeAvailable() {
        return minikubeUpgradeAvailable(this.context);
    }

    private profileForCurrentMode(): string | null | undefined {
        const active = this.activeProfiles.get(!!getUseWsl());
        return active ? active.profile : this.activeProfiles.size > 0 ? null : undefined;
    }
}

async function getVersionInfo(context: Context): Promise<MinikubeVersionInfo> {
    const sr = await invokeMinikubeCommand(context, ['update-check']);
    if (!sr || sr.code !== 0) {
        throw new Error(`Error checking for minikube updates: ${sr ? sr.stderr : 'cannot run minikube'}`);
    }
    const lines = sr.stdout.split('\n')
                           .map((l) => l.trim())
                           .filter((l) => l.length > 0);
    if (lines.length !== 2) {
        throw new Error(`Unexpected output for minikube version check: ${lines}`);
    }

    const currentVersion = extractVersion(lines[0]);
    const availableVersion = extractVersion(lines[1]);

    if (currentVersion === null || availableVersion === null) {
        throw new Error(`Unable to get version from minikube version check: ${lines}`);
    }

    return {
        currentVersion: currentVersion,
        availableVersion: availableVersion
    } as MinikubeVersionInfo;
}

async function minikubeUpgradeAvailable(context: Context): Promise<void> {

    const performUpgradeCheck = await checkPresent(context, CheckPresentMode.Silent) && getCheckForMinikubeUpgrade();
    if (!performUpgradeCheck) {
        return;
    }

    let versionInfo: MinikubeVersionInfo;

    try {
        versionInfo = await getVersionInfo(context);
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to determine minikube version: ${err}`);
        return;
    }

    const displayMinikubeShowInfo = await isMinikubeInfoDisplay();

    if (!displayMinikubeShowInfo) {
        return;
    }

    if (versionInfo.currentVersion !== versionInfo.availableVersion) {
        const value = await vscode.window.showInformationMessage(
            `Minikube upgrade available to ${versionInfo.availableVersion}, currently on ${versionInfo.currentVersion}`,
            ShowInformationOptions.Install,
            ShowInformationOptions.InstallFortNightly,
            ShowInformationOptions.InstallHalfYearly);

        if (value === ShowInformationOptions.Install) {
            const result = await installMinikube(context.shell, versionInfo.availableVersion);
            if (failed(result)) {
                vscode.window.showErrorMessage(`Failed to update minikube: ${result.error}`);
            }
        }

        if (value !== undefined) {
            setMinikubeShowInfo(value);
        }
    }
}

function extractVersion(line: string): string {
    const parts = line.split(': ');
    return parts[1];
}

async function isRunnableMinikube(context: Context): Promise<Errorable<Diagnostic>> {
    const resolution = await resolveForOperation(context, CheckPresentMode.Alert);
    if (!resolution) {
        return { succeeded: false, error: ['Minikube is not installed'] };
    }

    const sr = await executeMinikubeCommand(context, resolution, ['help']);
    return fromShellExitCodeOnly(sr, "Unable to run Minikube");
}

let minikubeStatusBarItem: vscode.StatusBarItem | undefined;

function getStatusBar(): vscode.StatusBarItem {
    if (!minikubeStatusBarItem) {
        minikubeStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    }
    return minikubeStatusBarItem;
}

type MinikubeStartResult =
    { readonly accepted: false } |
    { readonly accepted: true; readonly profile?: string; readonly useWsl: boolean };

const MINIKUBE_PROFILE_NOT_FOUND_EXIT_CODE = 85;

async function startMinikube(context: Context, options: MinikubeOptions): Promise<MinikubeStartResult> {
    const resolution = await resolveForOperation(context, CheckPresentMode.Alert);
    if (!resolution) {
        return { accepted: false };
    }
    const command = minikubeStartCommand(options);
    if (failed(command)) {
        vscode.window.showErrorMessage(`Failed to start cluster: ${command.error[0]}`);
        return { accepted: false };
    }
    const item = getStatusBar();
    item.text = 'minikube-starting';
    item.show();

    let status: MinikubeInfo;
    try {
        status = await minikubeStatusWithResolution(context, resolution, command.result.profile, true);
    } catch (err) {
        item.hide();
        vscode.window.showErrorMessage(`Failed to start cluster: ${err}`);
        return { accepted: false };
    }
    if (status.running) {
        vscode.window.showWarningMessage('Minikube cluster is already started.');
        item.text = 'minikube-running';
        return { accepted: true, profile: command.result.profile, useWsl: resolution.useWsl };
    }

    executeMinikubeCommand(context, resolution, command.result.args).then((result) => {
        if (result && result.code === 0) {
            vscode.window.showInformationMessage('Cluster started.');
            item.text = 'minikube-running';
        } else {
            vscode.window.showErrorMessage(`Failed to start cluster ${result ? result.stderr : "Unable to run Minikube"}`);
            item.hide();
        }
    }).catch((err) => {
        item.hide();
        vscode.window.showErrorMessage(`Failed to start cluster: ${err}`);
    });
    return { accepted: true, profile: command.result.profile, useWsl: resolution.useWsl };
}

async function stopMinikube(context: Context, profile?: string): Promise<void> {
    const resolution = await resolveForOperation(context, CheckPresentMode.Alert);
    if (!resolution) {
        return;
    }
    const item = getStatusBar();
    item.text = 'minikube-stopping';
    item.show();

    const status = await minikubeStatusWithResolution(context, resolution, profile);
    if (!status.running) {
        vscode.window.showWarningMessage('Minikube cluster is already stopped.');
        return;
    }

    try {
        const result = await executeMinikubeCommand(context, resolution, minikubeLifecycleArgs('stop', profile));
        if (result && result.code === 0) {
            vscode.window.showInformationMessage('Cluster stopped.');
            item.hide();
        } else {
            vscode.window.showErrorMessage(`Error stopping cluster ${result ? result.stderr : "Unable to run Minikube"}`);
            item.hide();
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Error stopping cluster: ${err}`);
        item.hide();
    }
}

async function minikubeStatus(context: Context, profile?: string, missingProfileIsStopped = false): Promise<MinikubeInfo> {
    const resolution = await resolveForOperation(context, CheckPresentMode.Silent);
    if (!resolution) {
        throw new Error('Minikube executable could not be found!');
    }
    return minikubeStatusWithResolution(context, resolution, profile, missingProfileIsStopped);
}

async function minikubeStatusWithResolution(
    context: Context,
    resolution: MinikubeResolution,
    profile?: string,
    missingProfileIsStopped = false
): Promise<MinikubeInfo> {
    const result = await executeMinikubeCommand(context, resolution, minikubeLifecycleArgs('status', profile));

    if (missingProfileIsStopped && result?.code === MINIKUBE_PROFILE_NOT_FOUND_EXIT_CODE) {
        return { running: false, message: result.stdout || result.stderr };
    }

    if (result && result.stderr.length === 0) {
        const hostItem = result.stdout.split('\n').find((status) => status.includes('host'));
        if (!hostItem) {
            throw new Error(`Failed to get host status: Unable to run Minikube`);
        }
        const hostStatus = hostItem.split(': ')[1].toLowerCase();
        return {
            running: 'stopped' !== hostStatus,
            message: `${result.stdout}`

        } as MinikubeInfo;
    }
    throw new Error(`Failed to get status: ${result ? result.stderr : "Unable to run Minikube"}`);
}

async function executeMinikubeCommand(
    _context: Context,
    resolution: MinikubeResolution,
    args: readonly string[]
): Promise<ProcessResult | undefined> {
    if (!resolution.useWsl && resolution.windows && /\.(?:cmd|bat)$/i.test(resolution.path.replace(/"$/, ''))) {
        return undefined;
    }
    const invocation = resolution.useWsl ? {
        executable: resolution.wsl!,
        args: ['--exec', resolution.path, ...args],
        cwd: resolution.cwd,
        env: resolution.environment,
    } : {
        executable: resolution.path,
        args,
        ...(resolution.argv0 ? { argv0: resolution.argv0 } : {}),
        cwd: resolution.cwd,
        env: resolution.environment,
    };
    try {
        return await processes.executeCommand(invocation);
    } catch (err) {
        return { code: -1, stdout: '', stderr: err instanceof Error ? err.message : String(err) };
    }
}

async function invokeMinikubeCommand(context: Context, args: readonly string[]): Promise<ProcessResult | undefined> {
    const resolution = await resolveForOperation(context, CheckPresentMode.Silent);
    if (!resolution) {
        return undefined;
    }
    return executeMinikubeCommand(context, resolution, args);
}

async function checkPresent(context: Context, mode: CheckPresentMode): Promise<boolean> {
    return !!await resolveForOperation(context, mode);
}

async function resolveForOperation(context: Context, mode: CheckPresentMode): Promise<MinikubeResolution | undefined> {
    const execution = executionContext(context);
    if (context.fixedBinary) {
        return context.fixedUseWsl === execution.useWsl && context.fixedPath ?
            { ...execution, path: context.fixedPath } : undefined;
    }
    return resolveMinikube(context, mode, execution);
}

function executionContext(context: Context): MinikubeExecutionContext {
    const useWsl = !!getUseWsl();
    const execOpts = context.shell.execOpts();
    const cwd = execOpts.cwd ?? process.cwd();
    const workspaceRoots = [...new Set([
        cwd,
        ...(vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.fsPath),
    ])];
    return {
        useWsl,
        windows: !useWsl && context.shell.isWindows(),
        cwd,
        environment: execOpts.env,
        workspaceRoots,
        ...(useWsl ? { wsl: windowsSystemExecutable(execOpts.env || process.env) } : {}),
    };
}

async function resolveMinikube(
    context: Context,
    mode: CheckPresentMode,
    execution: MinikubeExecutionContext
): Promise<MinikubeResolution | undefined> {
    const binName = 'minikube';
    const bin = getToolPath(context.host, context.shell, binName);
    if (bin) {
        if (!execution.useWsl && execution.windows && /\.(?:cmd|bat)$/i.test(bin.replace(/"$/, ''))) {
            if (mode === CheckPresentMode.Alert) {
                context.host.showErrorMessage(`Configured Minikube path '${bin}' is a command script; configure a minikube.exe path for shell-free execution.`);
            }
            return undefined;
        }
        const found = execution.useWsl ? await guestFileExists(bin, execution) : await context.fs.existsAsync(bin);
        if (found) {
            return { ...execution, path: execution.windows && !/\.(?:exe|com)$/i.test(bin) ? `${bin}.exe` : bin };
        }
        if (mode === CheckPresentMode.Alert) {
            showConfiguredMinikubeMissing(context.host, `${bin} does not exist!`);
        }
        return undefined;
    }

    const resolved = await resolveMinikubeExecutable(context, execution);
    if (resolved) {
        return { ...execution, ...resolved };
    }
    if (mode === CheckPresentMode.Alert) {
        showUnconfiguredMinikubeMissing(context.host, `Could not find "${binName}" binary.`);
    }
    return undefined;
}

async function guestFileExists(file: string, execution: MinikubeExecutionContext): Promise<boolean> {
    if (!execution.wsl || !path.posix.isAbsolute(file) || hasControlCharacters(file)) {
        return false;
    }
    try {
        const result = await processes.executeCommand({
            executable: execution.wsl,
            args: ['--exec', '/usr/bin/test', '-x', file],
            cwd: execution.cwd,
            env: execution.environment,
        });
        return result.code === 0;
    } catch (_err) {
        return false;
    }
}

interface ResolvedMinikubeExecutable {
    readonly path: string;
    readonly argv0?: string;
}

async function resolveMinikubeExecutable(
    context: Context,
    execution: MinikubeExecutionContext
): Promise<ResolvedMinikubeExecutable | undefined> {
    if (execution.useWsl) {
        if (!execution.wsl) {
            return undefined;
        }
        try {
            const found = await processes.executeCommand({
                executable: execution.wsl,
                args: ['--exec', '/usr/bin/which', 'minikube'],
                cwd: execution.cwd,
                env: execution.environment,
            });
            const alias = found.code === 0 ? singleAbsoluteGuestPath(found.stdout) : undefined;
            if (!alias) {
                return undefined;
            }
            const resolved = await processes.executeCommand({
                executable: execution.wsl,
                args: ['--exec', '/usr/bin/readlink', '-f', alias],
                cwd: execution.cwd,
                env: execution.environment,
            });
            const executable = resolved.code === 0 ? singleAbsoluteGuestPath(resolved.stdout) : undefined;
            const resolvedDirectoryResult = await executeWsl(execution, ['/usr/bin/readlink', '-f', path.posix.dirname(alias)]);
            const executableDirectory = resolvedDirectoryResult.code === 0 ? singleAbsoluteGuestPath(resolvedDirectoryResult.stdout) : undefined;
            if (!executable || !executableDirectory || !await guestFileExists(executable, execution) ||
                !await isWslExecutableOutsideWorkspaces(execution, alias, executableDirectory, executable)) {
                return undefined;
            }
            return { path: alias };
        } catch (_err) {
            return undefined;
        }
    }

    const alias = context.shell.which(execution.windows ? 'minikube.exe' : 'minikube')?.trim();
    if (!alias || !path.isAbsolute(alias) || (execution.windows && path.extname(alias).toLowerCase() !== '.exe')) {
        return undefined;
    }
    const executable = canonicalHostPath(alias);
    const executableDirectory = executable && canonicalHostPath(path.dirname(alias));
    if (!executable || !executableDirectory ||
        !trustedPathContains(execution.environment || process.env, executableDirectory, execution.windows)) {
        return undefined;
    }
    for (const root of execution.workspaceRoots) {
        const workspace = canonicalHostPath(root);
        if (!workspace || workspace === path.parse(workspace).root || isWithinHostPath(workspace, executableDirectory) || isWithinHostPath(workspace, executable)) {
            return undefined;
        }
    }
    return { path: executable, argv0: alias };
}

async function isWslExecutableOutsideWorkspaces(
    execution: MinikubeExecutionContext,
    alias: string,
    executableDirectory: string,
    executable: string
): Promise<boolean> {
    for (const root of execution.workspaceRoots) {
        const workspace = await wslWorkspacePath(execution, root);
        if (!workspace) {
            return false;
        }
        const canonicalResult = await executeWsl(execution, ['/usr/bin/readlink', '-f', workspace]);
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

async function wslWorkspacePath(execution: MinikubeExecutionContext, workspace: string): Promise<string | undefined> {
    if (/^\\\\wsl(?:\.localhost)?\\/i.test(workspace)) {
        return undefined;
    }
    if (path.posix.isAbsolute(workspace) && !hasControlCharacters(workspace)) {
        return workspace;
    }
    if (path.win32.isAbsolute(workspace)) {
        const result = await executeWsl(execution, ['/usr/bin/wslpath', '-a', '-u', workspace]);
        return result.code === 0 ? singleAbsoluteGuestPath(result.stdout) : undefined;
    }
    return undefined;
}

function executeWsl(execution: MinikubeExecutionContext, args: readonly string[]): Promise<ProcessResult> {
    return processes.executeCommand({
        executable: execution.wsl!,
        args: ['--exec', ...args],
        cwd: execution.cwd,
        env: execution.environment,
    });
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
        entry.length > 0 && path.isAbsolute(entry) && canonicalHostPath(entry) === directory
    );
}

function isWithinHostPath(parent: string, child: string): boolean {
    const caseInsensitive = process.platform === 'win32' || process.platform === 'darwin';
    const relative = path.relative(caseInsensitive ? parent.toLowerCase() : parent, caseInsensitive ? child.toLowerCase() : child);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function isWithinPosixPath(parent: string, child: string): boolean {
    const relative = path.posix.relative(parent, child);
    return relative === '' || (relative !== '..' && !relative.startsWith('../') && !path.posix.isAbsolute(relative));
}

function singleAbsoluteGuestPath(output: string): string | undefined {
    const lines = output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    return lines.length === 1 && path.posix.isAbsolute(lines[0]) && !hasControlCharacters(lines[0]) ? lines[0] : undefined;
}

function hasControlCharacters(value: string): boolean {
    return /[\u0000-\u001f\u007f-\u009f]/.test(value);
}

function showConfiguredMinikubeMissing(host: Host, message: string): void {
    host.showErrorMessage(message, 'Install dependencies').then((choice) => {
        if (choice === 'Install dependencies') {
            void import('../../installer/installdependencies').then((installer) => installer.installDependencies());
        }
    });
}

function showUnconfiguredMinikubeMissing(host: Host, message: string): void {
    host.showErrorMessage(message, 'Install dependencies', 'Learn more').then((choice) => {
        if (choice === 'Install dependencies') {
            void import('../../installer/installdependencies').then((installer) => installer.installDependencies());
        } else if (choice === 'Learn more') {
            host.showInformationMessage('Add minikube to PATH, or configure the vscode-kubernetes.minikube-path setting.');
        }
    });
}
