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
import { execPath, isWindowsCommandScript } from '../../../binutil';
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
    binFound: boolean;
    binPath: string;
    argv0?: string;
}

class MinikubeImpl implements Minikube {
    private readonly context: Context;
    private activeProfile: string | undefined;

    constructor(host: Host, fs: FS, shell: Shell, toolFound: boolean, binPath = 'minikube') {
        this.context = { host: host, fs: fs, shell: shell, binFound: toolFound, binPath };
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
        this.activeProfile = started.profile;
        return started.accepted;
    }

    stop(): Promise<void> {
        return stopMinikube(this.context, this.activeProfile);
    }

    status(): Promise<MinikubeInfo> {
        return minikubeStatus(this.context, this.activeProfile);
    }

    checkUpgradeAvailable() {
        return minikubeUpgradeAvailable(this.context);
    }
}

async function getVersionInfo(context: Context): Promise<MinikubeVersionInfo> {
    const sr = await executeMinikubeCommand(context, ['update-check']);
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
    if (!await checkPresent(context, CheckPresentMode.Alert)) {
        return { succeeded: false, error: ['Minikube is not installed'] };
    }

    const sr = await executeMinikubeCommand(context, ['help']);
    return fromShellExitCodeOnly(sr, "Unable to run Minikube");
}

let minikubeStatusBarItem: vscode.StatusBarItem | undefined;

function getStatusBar(): vscode.StatusBarItem {
    if (!minikubeStatusBarItem) {
        minikubeStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    }
    return minikubeStatusBarItem;
}

interface MinikubeStartResult {
    readonly accepted: boolean;
    readonly profile?: string;
}

const MINIKUBE_PROFILE_NOT_FOUND_EXIT_CODE = 85;

async function startMinikube(context: Context, options: MinikubeOptions): Promise<MinikubeStartResult> {
    if (!await checkPresent(context, CheckPresentMode.Alert)) {
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

    const status = await minikubeStatus(context, command.result.profile, true);
    if (status.running) {
        vscode.window.showWarningMessage('Minikube cluster is already started.');
        item.text = 'minikube-running';
        return { accepted: true, profile: command.result.profile };
    }

    executeMinikubeCommand(context, command.result.args).then((result) => {
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
    return { accepted: true, profile: command.result.profile };
}

async function stopMinikube(context: Context, profile?: string): Promise<void> {
    if (!await checkPresent(context, CheckPresentMode.Alert)) {
        return;
    }
    const item = getStatusBar();
    item.text = 'minikube-stopping';
    item.show();

    const status = await minikubeStatus(context, profile);
    if (!status.running) {
        vscode.window.showWarningMessage('Minikube cluster is already stopped.');
        return;
    }

    try {
        const result = await executeMinikubeCommand(context, minikubeLifecycleArgs('stop', profile));
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
    if (!await checkPresent(context, CheckPresentMode.Silent)) {
        throw new Error('Minikube executable could not be found!');
    }

    const result = await executeMinikubeCommand(context, minikubeLifecycleArgs('status', profile));

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

async function executeMinikubeCommand(context: Context, args: readonly string[]): Promise<ProcessResult | undefined> {
    if (isWindowsCommandScript(context.shell, context.binPath)) {
        return undefined;
    }
    const execOpts = context.shell.execOpts();
    const wsl = getUseWsl() ? windowsSystemExecutable(execOpts.env || process.env) : undefined;
    if (getUseWsl() && !wsl) {
        return undefined;
    }
    const invocation = getUseWsl() ? {
        executable: wsl!,
        args: ['--exec', context.binPath, ...args],
        cwd: execOpts.cwd,
        env: execOpts.env,
    } : {
        executable: execPath(context.shell, context.binPath),
        args,
        ...(context.argv0 ? { argv0: context.argv0 } : {}),
        cwd: execOpts.cwd,
        env: execOpts.env,
    };
    try {
        return await processes.executeCommand(invocation);
    } catch (err) {
        return { code: -1, stdout: '', stderr: err instanceof Error ? err.message : String(err) };
    }
}

async function invokeMinikubeCommand(context: Context, args: readonly string[]): Promise<ProcessResult | undefined> {
    if (!await checkPresent(context, CheckPresentMode.Silent)) {
        return undefined;
    }
    return executeMinikubeCommand(context, args);
}

async function checkPresent(context: Context, mode: CheckPresentMode): Promise<boolean> {
    if (context.binFound) {
        return true;
    }

    return await checkForMinikubeInternal(context, mode);
}

async function checkForMinikubeInternal(context: Context, mode: CheckPresentMode): Promise<boolean> {
    const binName = 'minikube';
    const bin = getToolPath(context.host, context.shell, binName);
    if (bin) {
        if (!getUseWsl() && isWindowsCommandScript(context.shell, bin)) {
            if (mode === CheckPresentMode.Alert) {
                context.host.showErrorMessage(`Configured Minikube path '${bin}' is a command script; configure a minikube.exe path for shell-free execution.`);
            }
            return false;
        }
        const found = getUseWsl() ? await guestFileExists(context, bin) : await context.fs.existsAsync(bin);
        if (found) {
            context.binFound = true;
            context.binPath = bin;
            return true;
        }
        if (mode === CheckPresentMode.Alert) {
            showConfiguredMinikubeMissing(context.host, `${bin} does not exist!`);
        }
        return false;
    }

    const resolved = await resolveMinikubeExecutable(context);
    if (resolved) {
        context.binFound = true;
        context.binPath = resolved.path;
        context.argv0 = resolved.argv0;
        return true;
    }
    if (mode === CheckPresentMode.Alert) {
        showUnconfiguredMinikubeMissing(context.host, `Could not find "${binName}" binary.`);
    }
    return false;
}

async function guestFileExists(context: Context, file: string): Promise<boolean> {
    if (!path.posix.isAbsolute(file) || hasControlCharacters(file)) {
        return false;
    }
    const execOpts = context.shell.execOpts();
    const wsl = windowsSystemExecutable(execOpts.env || process.env);
    if (!wsl) {
        return false;
    }
    try {
        const result = await processes.executeCommand({
            executable: wsl,
            args: ['--exec', '/usr/bin/test', '-x', file],
            cwd: execOpts.cwd,
            env: execOpts.env,
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

async function resolveMinikubeExecutable(context: Context): Promise<ResolvedMinikubeExecutable | undefined> {
    const execOpts = context.shell.execOpts();
    if (getUseWsl()) {
        const wsl = windowsSystemExecutable(execOpts.env || process.env);
        if (!wsl) {
            return undefined;
        }
        try {
            const found = await processes.executeCommand({
                executable: wsl,
                args: ['--exec', '/usr/bin/which', 'minikube'],
                cwd: execOpts.cwd,
                env: execOpts.env,
            });
            const alias = found.code === 0 ? singleAbsoluteGuestPath(found.stdout) : undefined;
            if (!alias) {
                return undefined;
            }
            const resolved = await processes.executeCommand({
                executable: wsl,
                args: ['--exec', '/usr/bin/readlink', '-f', alias],
                cwd: execOpts.cwd,
                env: execOpts.env,
            });
            const executable = resolved.code === 0 ? singleAbsoluteGuestPath(resolved.stdout) : undefined;
            const resolvedDirectoryResult = await executeWsl(context, wsl, ['/usr/bin/readlink', '-f', path.posix.dirname(alias)]);
            const executableDirectory = resolvedDirectoryResult.code === 0 ? singleAbsoluteGuestPath(resolvedDirectoryResult.stdout) : undefined;
            if (!executable || !executableDirectory || !await guestFileExists(context, executable) ||
                !await isWslExecutableOutsideWorkspaces(context, wsl, alias, executableDirectory, executable)) {
                return undefined;
            }
            return { path: alias };
        } catch (_err) {
            return undefined;
        }
    }

    const alias = context.shell.which(context.shell.isWindows() ? 'minikube.exe' : 'minikube')?.trim();
    if (!alias || !path.isAbsolute(alias) || (context.shell.isWindows() && path.extname(alias).toLowerCase() !== '.exe')) {
        return undefined;
    }
    const executable = canonicalHostPath(alias);
    const executableDirectory = executable && canonicalHostPath(path.dirname(alias));
    if (!executable || !executableDirectory || !trustedPathContains(execOpts.env || process.env, executableDirectory, context.shell.isWindows())) {
        return undefined;
    }
    const workspaceRoots = [...new Set([
        ...(execOpts.cwd ? [execOpts.cwd] : []),
        ...(vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.fsPath),
    ])];
    for (const root of workspaceRoots) {
        const workspace = canonicalHostPath(root);
        if (!workspace || workspace === path.parse(workspace).root || isWithinHostPath(workspace, executableDirectory) || isWithinHostPath(workspace, executable)) {
            return undefined;
        }
    }
    return { path: executable, argv0: alias };
}

async function isWslExecutableOutsideWorkspaces(
    context: Context,
    wsl: string,
    alias: string,
    executableDirectory: string,
    executable: string
): Promise<boolean> {
    const execOpts = context.shell.execOpts();
    const roots = [...new Set([
        ...(execOpts.cwd ? [execOpts.cwd] : []),
        ...(vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.fsPath),
    ])];
    for (const root of roots) {
        const workspace = await wslWorkspacePath(context, wsl, root);
        if (!workspace) {
            return false;
        }
        const canonicalResult = await executeWsl(context, wsl, ['/usr/bin/readlink', '-f', workspace]);
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

async function wslWorkspacePath(context: Context, wsl: string, workspace: string): Promise<string | undefined> {
    if (/^\\\\wsl(?:\.localhost)?\\/i.test(workspace)) {
        return undefined;
    }
    if (path.posix.isAbsolute(workspace) && !hasControlCharacters(workspace)) {
        return workspace;
    }
    if (path.win32.isAbsolute(workspace)) {
        const result = await executeWsl(context, wsl, ['/usr/bin/wslpath', '-a', '-u', workspace]);
        return result.code === 0 ? singleAbsoluteGuestPath(result.stdout) : undefined;
    }
    return undefined;
}

function executeWsl(context: Context, wsl: string, args: readonly string[]): Promise<ProcessResult> {
    const execOpts = context.shell.execOpts();
    return processes.executeCommand({
        executable: wsl,
        args: ['--exec', ...args],
        cwd: execOpts.cwd,
        env: execOpts.env,
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
