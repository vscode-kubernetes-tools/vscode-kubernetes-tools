import * as config from './components/config/config';
import { Shell } from './shell';
import { Host } from './host';
import { FS } from './fs';
import * as nativeFs from 'fs';
import * as path from 'path';
import { executeCommand } from './process';
import { getWindowsSystemExecutable } from './wsl';

export interface BinCheckContext {
    readonly host: Host;
    readonly fs: FS;
    readonly shell: Shell;
    binFound: boolean;
    binPath: string;
}

export type BinaryCommandExecutor = typeof executeCommand;

const BINARY_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export async function findBinaryPath(shell: Shell, binName: string, execute: BinaryCommandExecutor = executeCommand): Promise<string | undefined> {
    if (!BINARY_NAME_PATTERN.test(binName)) {
        return undefined;
    }
    if (!config.getUseWsl()) {
        return findNativeBinaryPath(shell, binName);
    }

    const opts = shell.execOpts();
    const environment = opts.env || process.env;
    const wsl = getWindowsSystemExecutable('wsl.exe', environment);
    if (!wsl) {
        return undefined;
    }
    try {
        // A fixed script is required to preserve PATH initialization by the user's guest shell.
        const result = await execute({
            executable: wsl,
            args: [
                '--exec', '/bin/sh', '-c',
                'exec /usr/bin/env VSCODE_KUBERNETES_TOOL="$1" "${SHELL:-/bin/sh}" -c \'which -- "$VSCODE_KUBERNETES_TOOL"\'',
                'vscode-kubernetes-which', binName,
            ],
            cwd: opts.cwd,
            env: environment,
        });
        return result.code === 0 ? singleAbsoluteGuestPath(result.stdout) : undefined;
    } catch (_err) {
        return undefined;
    }
}

export async function wslBinaryPathExists(shell: Shell, binaryPath: string, execute: BinaryCommandExecutor = executeCommand): Promise<boolean> {
    if (!binaryPath) {
        return false;
    }
    const opts = shell.execOpts();
    const environment = opts.env || process.env;
    const wsl = getWindowsSystemExecutable('wsl.exe', environment);
    if (!wsl) {
        return false;
    }
    try {
        const result = await execute({
            executable: wsl,
            args: ['--exec', '/usr/bin/test', '-e', binaryPath],
            cwd: opts.cwd,
            env: environment,
        });
        return result.code === 0;
    } catch (_err) {
        return false;
    }
}

function findNativeBinaryPath(shell: Shell, binName: string): string | undefined {
    const environment = shell.execOpts().env || process.env;
    const windows = shell.isWindows();
    const pathKey = windows ? Object.keys(environment).find((key) => key.toLowerCase() === 'path') : 'PATH';
    const pathValue = pathKey ? environment[pathKey] : undefined;
    if (!pathValue) {
        return undefined;
    }

    const pathApi = windows ? path.win32 : path;
    const delimiter = windows ? ';' : path.delimiter;
    const filename = windows && !binName.toLowerCase().endsWith('.exe') ? `${binName}.exe` : binName;
    for (const rawEntry of pathValue.split(delimiter)) {
        const entry = windows && rawEntry.length > 1 && rawEntry.startsWith('"') && rawEntry.endsWith('"') ? rawEntry.slice(1, -1) : rawEntry;
        if (!entry || !pathApi.isAbsolute(entry)) {
            continue;
        }
        const candidate = pathApi.join(entry, filename);
        try {
            if (!nativeFs.statSync(candidate).isFile()) {
                continue;
            }
            if (!windows) {
                nativeFs.accessSync(candidate, nativeFs.constants.X_OK);
            }
            return candidate;
        } catch (_err) {
            // Continue to the next PATH entry.
        }
    }
    return undefined;
}

function singleAbsoluteGuestPath(output: string): string | undefined {
    const lines = output.split(/\r?\n/).filter((line) => line.length > 0);
    const value = lines.length === 1 ? lines[0] : undefined;
    return value && path.posix.isAbsolute(value) && !CONTROL_CHARACTERS.test(value) ? value : undefined;
}

export function execPath(shell: Shell, basePath: string): string {
    let bin = basePath;
    const unquotedBin = bin && bin.endsWith('"') ? bin.slice(0, -1) : bin;
    if (shell.isWindows() && bin && !/\.(?:exe|com|cmd|bat)$/i.test(unquotedBin)) {
        bin = bin.slice(-1) === '"' ? `${bin.slice(0, -1)}.exe"` : `${bin}.exe`;
    }
    return bin;
}

export function isWindowsCommandScript(shell: Shell, executable: string): boolean {
    return shell.isWindows() && /\.(?:cmd|bat)$/i.test(executable.replace(/"$/, ''));
}

type CheckPresentFailureReason = 'inferFailed' | 'configuredFileMissing';

function alertNoBin(host: Host, binName: string, failureReason: CheckPresentFailureReason, message: string): void {
    switch (failureReason) {
        case 'inferFailed':
            host.showErrorMessage(message, 'Install dependencies', 'Learn more').then(
                (str) => {
                    switch (str) {
                        case 'Learn more':
                            host.showInformationMessage(`Add ${binName} directory to path, or set "vs-kubernetes.${binName}-path" config to ${binName} binary.`);
                            break;
                        case 'Install dependencies':
                            void import('./components/installer/installdependencies').then((installer) => installer.installDependencies());
                            break;
                    }

                }
            );
            break;
        case 'configuredFileMissing':
            host.showErrorMessage(message, 'Install dependencies').then(
                (str) => {
                    if (str === 'Install dependencies') {
                        void import('./components/installer/installdependencies').then((installer) => installer.installDependencies());
                    }
                }
            );
            break;
    }
}

export async function checkForBinary(context: BinCheckContext, bin: string | undefined, binName: string, inferFailedMessage: string, configuredFileMissingMessage: string, alertOnFail: boolean): Promise<boolean> {
    if (!bin) {
        const binaryPath = await findBinaryPath(context.shell, binName);

        if (!binaryPath) {
            if (alertOnFail) {
                alertNoBin(context.host, binName, 'inferFailed', inferFailedMessage);
            }
            return false;
        }

        context.binFound = true;
        context.binPath = binaryPath;

        return true;
    }

    if (!config.getUseWsl()) {
        context.binFound = context.fs.existsSync(bin);
    } else {
        context.binFound = await wslBinaryPathExists(context.shell, bin);
    }
    if (context.binFound) {
        context.binPath = bin;
    } else {
        if (alertOnFail) {
            alertNoBin(context.host, binName, 'configuredFileMissing', configuredFileMissingMessage);
        }
    }

    return context.binFound;
}
