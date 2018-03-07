'use strict';

import * as vscode from 'vscode';
import * as shelljs from 'shelljs';

export interface Shell {
    isWindows() : boolean;
    isUnix() : boolean;
    home() : string;
    combinePath(basePath : string, relativePath : string);
    fileUri(filePath) : vscode.Uri;
    execOpts() : any;
    exec(cmd : string) : Promise<ShellResult>;
    execCore(cmd : string, opts : any) : Promise<ShellResult>;
}

export const shell : Shell = {
    isWindows : isWindows,
    isUnix : isUnix,
    home : home,
    combinePath : combinePath,
    fileUri : fileUri,
    execOpts : execOpts,
    exec : exec,
    execCore : execCore
};

const WINDOWS : string = 'win32';

export interface ShellResult {
    readonly code : number;
    readonly stdout : string;
    readonly stderr : string;
}

export type ShellHandler = (code : number, stdout : string, stderr : string) => void;

function isWindows() : boolean {
    return (process.platform === WINDOWS);
}

function isUnix() : boolean {
    return !isWindows();
}

function home() : string {
    const homeVar = isWindows() ? 'USERPROFILE' : 'HOME';
    return process.env[homeVar];
}

function combinePath(basePath : string, relativePath : string) {
    let separator = '/';
    if (isWindows()) {
        relativePath = relativePath.replace(/\//g, '\\');
        separator = '\\';
    }
    return basePath + separator + relativePath;
}

function fileUri(filePath : string) : vscode.Uri {
    if (isWindows()) {
        return vscode.Uri.parse('file:///' + filePath.replace(/\\/g, '/'));
    }
    return vscode.Uri.parse('file://' + filePath);
}

function execOpts() : any {
    let env = process.env;
    if (isWindows()) {
        env = Object.assign({ }, env, { HOME: home() });
    }
    const opts = {
        cwd: vscode.workspace.rootPath,
        env: env,
        async: true
    };
    return opts;
}

async function exec(cmd : string) : Promise<ShellResult> {
    try {
        return await execCore(cmd, execOpts());
    } catch (ex) {
        vscode.window.showErrorMessage(ex);
    }
}

function execCore(cmd : string, opts : any) : Promise<ShellResult> {
    return new Promise<ShellResult>((resolve, reject) => {
        shelljs.exec(cmd, opts, (code, stdout, stderr) => resolve({code : code, stdout : stdout, stderr : stderr}));
    });
}

export function isShellResult<T>(obj : T | ShellResult) : obj is ShellResult {
    const sr = <ShellResult>obj;
    return sr.code !== undefined || sr.stdout !== undefined || sr.stderr !== undefined;
}