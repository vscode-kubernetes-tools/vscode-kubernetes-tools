import * as fs from 'fs';
import { executeCommandSync } from './process';

import { getUseWsl } from './components/config/config';

export interface Stats {
    isDirectory(): boolean;
}

class StatImpl {
    constructor(readonly line: string) {
        this.line = line;
    }

    public isDirectory(): boolean {
        return this.line.startsWith('d');
    }
}

function executeWslCommand(args: readonly string[]) {
    return executeCommandSync('wsl.exe', ['--exec', ...args]);
}

export function statSync(file: string): Stats {
    if (getUseWsl()) {
        const filePath = file.replace(/\\/g, '/');
        const result = executeWslCommand(['stat', '--format=%A', '--', filePath]);
        if (result.code !== 0) {
            if (result.stderr.indexOf('No such file or directory') !== -1) {
                return new StatImpl('');
            }
            throw new Error(result.stderr);
        }
        return new StatImpl(result.stdout.trim());
    } else {
        return fs.statSync(file);
    }
}

export function existsSync(file: string): boolean {
    if (getUseWsl()) {
        const filePath = file.replace(/\\/g, '/');
        const result = executeWslCommand(['test', '-e', filePath]);
        return result.code === 0;
    } else {
        return fs.existsSync(file);
    }
}

export function unlinkSync(file: string) {
    if (getUseWsl()) {
        const filePath = file.replace(/\\/g, '/');
        const result = executeWslCommand(['rm', '-rf', '--', filePath]);
        if (result.code !== 0) {
            throw new Error(result.stderr);
        }
        return;
    }
    fs.unlinkSync(file);
}
