import { spawnSync } from 'child_process';
import type { ShellResult } from './shell';

export function normalizeWslPath(filePath: string): string {
    // Backslashes are filename characters in absolute guest paths.
    return filePath.startsWith('/') ? filePath : filePath.replace(/\\/g, '/');
}

export function execWslSync(args: readonly string[]): ShellResult {
    const result = spawnSync('wsl.exe', ['--exec', ...args], {
        encoding: 'utf8', shell: false, windowsHide: true, maxBuffer: 20 * 1024 * 1024,
    });
    if (result.error) {
        throw new Error(`Unable to run WSL: ${result.error.message}`);
    }
    return { code: result.status ?? -1, stdout: result.stdout || '', stderr: result.stderr || '' };
}
