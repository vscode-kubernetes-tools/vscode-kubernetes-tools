'use strict';

import * as vscode from 'vscode';
import * as shelljs from 'shelljs';
import * as path from 'path';
import { getToolPath, getUseWsl } from './components/config/config';
import { host } from './host';
import { ChildProcess } from 'child_process';
import { getKubeconfigPath } from './components/kubectl/kubeconfig';
import { ExecResult } from './binutilplusplus';

export enum Platform {
    Windows,
    MacOS,
    Linux,
    Unsupported,  // shouldn't happen!
}

export interface ExecCallback extends shelljs.ExecCallback {}

export interface Shell {
    isWindows(): boolean;
    isUnix(): boolean;
    platform(): Platform;
    home(): string;
    combinePath(basePath: string, relativePath: string): string;
    fileUri(filePath: string): vscode.Uri;
    execOpts(): any;
    exec(cmd: string, stdin?: string): Promise<ShellResult | undefined>;
    execStreaming(cmd: string, callback: ((proc: ChildProcess) => void) | undefined): Promise<ShellResult | undefined>;
    execCore(cmd: string, opts: any, callback?: (proc: ChildProcess) => void, stdin?: string): Promise<ShellResult>;
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
    exec : exec,
    execStreaming: execStreaming,
    execCore : execCore,
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

export type ShellHandler = (code: number, stdout: string, stderr: string) => void;

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
        return shelljs.exec('wsl.exe echo ${HOME}').stdout.trim();
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

async function exec(cmd: string, stdin?: string): Promise<ShellResult | undefined> {
    try {
        return await execCore(cmd, execOpts(), null, stdin);
    } catch (ex) {
        vscode.window.showErrorMessage(ex);
        return undefined;
    }
}

async function execStreaming(cmd: string, callback: (proc: ChildProcess) => void): Promise<ShellResult | undefined> {
    try {
        return await execCore(cmd, execOpts(), callback);
    } catch (ex) {
        vscode.window.showErrorMessage(ex);
        return undefined;
    }
}

function execCore(cmd: string, opts: any, callback?: ((proc: ChildProcess) => void) | null, stdin?: string): Promise<ShellResult> {
    return new Promise<ShellResult>((resolve) => {
        if (getUseWsl()) {
            cmd = 'wsl ' + cmd;
        }
        const proc = shelljs.exec(cmd, opts, (code, stdout, stderr) => resolve({code : code, stdout : stdout, stderr : stderr}));
        if (stdin) {
            proc.stdin.end(stdin);
        }
        if (callback) {
            callback(proc);
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
    for (const tool of ['kubectl', 'helm', 'draft', 'minikube']) {
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
        const result = shelljs.exec(`wsl.exe which ${bin}`);
        if (result.code !== 0) {
            throw new Error(result.stderr);
        }
        return result.stdout;
    }
    return shelljs.which(bin);
}

function cat(path: string): string {
    if (getUseWsl()) {
        const filePath = path.replace(/\\/g, '/');
        const result = shelljs.exec(`wsl.exe cat ${filePath}`);
        if (result.code !== 0) {
            throw new Error(result.stderr);
        }
        return result.stdout;
    }
    return shelljs.cat(path);
}

function ls(path: string): string[] {
    if (getUseWsl()) {
        const filePath = path.replace(/\\/g, '/');
        const result = shelljs.exec(`wsl.exe ls ${filePath}`);
        if (result.code !== 0) {
            throw new Error(result.stderr);
        }
        return result.stdout.trim().split('\n');
    }
    return shelljs.ls(path);
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
