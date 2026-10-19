'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { readFileSync, readdirSync } from 'fs';
import { getToolPath, getUseWsl } from './components/config/config';
import { host } from './host';
import type { ChildProcess } from './process';
import { executeCommandSync } from './process';
import { getKubeconfigPath } from './components/kubectl/kubeconfig';
import { ExecResult } from './binutilplusplus';
import { kubeChannel } from './kubeChannel';

export enum Platform {
    Windows,
    MacOS,
    Linux,
    Unsupported,  // shouldn't happen!
}

export type ExecCallback = (code: number, stdout: string, stderr: string) => void;

export interface Shell {
    isWindows(): boolean;
    isUnix(): boolean;
    platform(): Platform;
    home(): string;
    combinePath(basePath: string, relativePath: string): string;
    fileUri(filePath: string): vscode.Uri;
    execOpts(): any;
    unquotedPath(path: string): string;
    which(bin: string): string | null;
    cat(path: string): string;
    ls(path: string): string[];
}

export const shell: Shell = {
    isWindows : isWindows,
    isUnix : isUnix,
    platform : platform,
    home : home,
    combinePath : combinePath,
    fileUri : fileUri,
    execOpts : execOpts,
    unquotedPath : unquotedPath,
    which: which,
    cat: cat,
    ls: ls,
};

const WINDOWS: string = 'win32';

export interface ShellResult {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
}

function executeWslSync(args: readonly string[]): ShellResult {
    return executeCommandSync('wsl.exe', ['--exec', ...args]);
}

function isWindows(): boolean {
    return (process.platform === WINDOWS) && !getUseWsl();
}

function isUnix(): boolean {
    return !isWindows();
}

function platform(): Platform {
    if (getUseWsl()) {
        return Platform.Linux;
    }
    switch (process.platform) {
        case 'win32': return Platform.Windows;
        case 'darwin': return Platform.MacOS;
        case 'linux': return Platform.Linux;
        default: return Platform.Unsupported;
    }
}

function concatIfSafe(homeDrive: string | undefined, homePath: string | undefined): string | undefined {
    if (homeDrive && homePath) {
        const safe = !homePath.toLowerCase().startsWith('\\windows\\system32');
        if (safe) {
            return homeDrive.concat(homePath);
        }
    }

    return undefined;
}

function home(): string {
    if (getUseWsl()) {
        return executeWslSync(['printenv', 'HOME']).stdout.trim();
    }
    return process.env['HOME'] ||
        concatIfSafe(process.env['HOMEDRIVE'], process.env['HOMEPATH']) ||
        process.env['USERPROFILE'] ||
        '';
}

function combinePath(basePath: string, relativePath: string) {
    let separator = '/';
    if (isWindows()) {
        relativePath = relativePath.replace(/\//g, '\\');
        separator = '\\';
    }
    return basePath + separator + relativePath;
}

function isWindowsFilePath(filePath: string) {
    return filePath[1] === ':' && filePath[2] === '\\';
}

function fileUri(filePath: string): vscode.Uri {
    if (isWindowsFilePath(filePath)) {
        return vscode.Uri.parse('file:///' + filePath.replace(/\\/g, '/'));
    }
    return vscode.Uri.parse('file://' + filePath);
}

function execOpts(): any {
    let env = process.env;
    if (isWindows()) {
        env = Object.assign({ }, env, { HOME: home() });
    }
    env = shellEnvironment(env);
    const opts = {
        cwd: vscode.workspace.rootPath,
        env: env,
        async: true
    };
    return opts;
}

// Pattern to detect Azure AD device login prompts (covers multiple URL variants)
// Known URLs: microsoft.com/devicelogin, login.microsoft.com/device, login.microsoftonline.com/.../oauth2/deviceauth
// Requires https:// prefix to avoid matching substrings in unrelated URLs
const AUTH_PROMPT_PATTERN = /https:\/\/(?:[a-z0-9-]+\.)?microsoft(?:online)?\.com\/(?:device|devicelogin|common\/oauth2\/deviceauth)/i;

let authNotificationShown = false;

export function monitorForAuthPrompt(proc: ChildProcess): void {
    if (!proc.stderr) {
        return;
    }

    let authPromptDetected = false;
    let stderrBuffer = '';

    proc.stderr.on('data', (data: Buffer | string) => {
        stderrBuffer += data.toString();

        // Process complete lines to detect full auth prompts
        let newlineIndex = stderrBuffer.indexOf('\n');
        while (newlineIndex !== -1) {
            const line = stderrBuffer.slice(0, newlineIndex + 1);
            stderrBuffer = stderrBuffer.slice(newlineIndex + 1);

            if (AUTH_PROMPT_PATTERN.test(line) && !authNotificationShown) {
                authNotificationShown = true;
                authPromptDetected = true;
                kubeChannel.showOutput(line, 'Authentication Required');
                vscode.window.showWarningMessage('Authentication required. See Kubernetes output for instructions.');
                // Reset flag after cooldown so future auth prompts can show
                setTimeout(() => { authNotificationShown = false; }, 1000);
            }

            newlineIndex = stderrBuffer.indexOf('\n');
        }
    });

    // Notify user when auth completes successfully
    proc.on('exit', (code) => {
        if (authPromptDetected && code === 0) {
            vscode.window.showInformationMessage('Authentication successful. You may need to refresh or retry your last action.');
        }
    });
}

function unquotedPath(path: string): string {
    if (isWindows() && path && path.length > 1 && path.startsWith('"') && path.endsWith('"')) {
        return path.substring(1, path.length - 1);
    }
    return path;
}

export function shellEnvironment(baseEnvironment: any): any {
    const env = Object.assign({}, baseEnvironment);
    const pathVariable = pathVariableName(env);
    for (const tool of ['kubectl', 'helm', 'minikube']) {
        const toolPath = getToolPath(host, shell, tool);
        if (toolPath) {
            const toolDirectory = path.dirname(toolPath);
            const currentPath = env[pathVariable];
            env[pathVariable] = toolDirectory + (currentPath ? `${pathEntrySeparator()}${currentPath}` : '');
        }
    }

    const kubeconfigPath = getKubeconfigPath();
    env['KUBECONFIG'] = kubeconfigPath.pathType === "host" ? kubeconfigPath.hostPath : kubeconfigPath.wslPath;
    return env;
}

function pathVariableName(env: any): string {
    if (isWindows()) {
        for (const v of Object.keys(env)) {
            if (v.toLowerCase() === "path") {
                return v;
            }
        }
    }
    return "PATH";
}

function pathEntrySeparator() {
    return isWindows() ? ';' : ':';
}

function which(bin: string): string | null {
    if (getUseWsl()) {
        const result = executeWslSync(['which', bin]);
        if (result.code !== 0) {
            throw new Error(result.stderr);
        }
        return result.stdout;
    }
    const command = isWindows() ? 'where.exe' : 'which';
    const args = [bin];
    try {
        const result = executeCommandSync(command, args);
        const resolved = result.stdout.split(/\r?\n/).find((line) => line.trim().length > 0);
        return result.code === 0 && resolved ? resolved.trim() : null;
    } catch (_err) {
        return null;
    }
}

function cat(path: string): string {
    if (getUseWsl()) {
        const filePath = path.replace(/\\/g, '/');
        const result = executeWslSync(['cat', '--', filePath]);
        if (result.code !== 0) {
            throw new Error(result.stderr);
        }
        return result.stdout;
    }
    return readFileSync(path, 'utf8');
}

function ls(path: string): string[] {
    if (getUseWsl()) {
        const filePath = path.replace(/\\/g, '/');
        const result = executeWslSync(['ls', '--', filePath]);
        if (result.code !== 0) {
            throw new Error(result.stderr);
        }
        return result.stdout.trim().split('\n');
    }
    return readdirSync(path);
}

export function shellMessage(er: ExecResult, invocationFailureMessage: string): string {
    if (er.resultKind === 'exec-bin-not-found' || er.resultKind === 'exec-failed') {
        return invocationFailureMessage;
    }
    return er.resultKind === 'exec-succeeded' ? er.stdout : er.stderr;
}

const SAFE_CHARS_REGEX = /^[-,._+:@%/\w]*$/;

export function isSafe(s: string): boolean {
    return SAFE_CHARS_REGEX.test(s);
}
