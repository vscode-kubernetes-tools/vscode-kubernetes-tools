import * as fs from 'fs';
// TODO: would rather this was in ./shell.ts
import * as shell from 'shelljs';

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

export function statSync(file: string): Stats {
    if (getUseWsl()) {
        const filePath = file.replace(/\\/g, '/');
        const result = shell.exec(`wsl.exe sh -c "ls -l ${filePath} | grep -v total"`);
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
        const result = shell.exec(`wsl.exe ls ${filePath}`);
        return result.code === 0;
    } else {
        return fs.existsSync(file);
    }
}

export function unlinkSync(file: string) {
    if (getUseWsl()) {
        const filePath = file.replace(/\\/g, '/');
        const result = shell.exec(`wsl.exe rm -rf ${filePath}`);
        if (result.code !== 0) {
            throw new Error(result.stderr);
        }
    }
    fs.unlinkSync(file);
}