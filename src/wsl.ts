import { spawnSync } from 'child_process';
import type { ShellResult } from './shell';
import * as path from 'path';

export function getWindowsSystemExecutable(filename: string, environment: NodeJS.ProcessEnv): string | undefined {
    const key = Object.keys(environment).find((name) => name.toLowerCase() === 'systemroot') ||
        Object.keys(environment).find((name) => name.toLowerCase() === 'windir');
    const windowsDirectory = key ? environment[key] : undefined;
    return windowsDirectory && path.win32.isAbsolute(windowsDirectory) ?
        path.win32.join(windowsDirectory, 'System32', filename) :
        undefined;
}

export function normalizeWslPath(filePath: string): string {
    // Backslashes are filename characters in absolute guest paths.
    return filePath.startsWith('/') ? filePath : filePath.replace(/\\/g, '/');
}

export function execWslSync(args: readonly string[]): ShellResult {
    const executable = getWindowsSystemExecutable('wsl.exe', process.env);
    if (!executable) {
        throw new Error('Unable to find the Windows system WSL executable.');
    }
    const result = spawnSync(executable, ['--exec', ...args], {
        encoding: 'utf8', shell: false, windowsHide: true, maxBuffer: 20 * 1024 * 1024,
    });
    if (result.error) {
        throw new Error(`Unable to run WSL: ${result.error.message}`);
    }
    return { code: result.status ?? -1, stdout: result.stdout || '', stderr: result.stderr || '' };
}
