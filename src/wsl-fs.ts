import * as fs from 'fs';

import { getUseWsl } from './components/config/config';
import { execWslSync, normalizeWslPath } from './wsl';

export interface Stats {
    isDirectory(): boolean;
}

const FILE_TYPE_MASK = 0o170000;
const DIRECTORY_TYPE = 0o040000;

class StatImpl {
    constructor(private readonly mode: number) {}

    public isDirectory(): boolean {
        return (this.mode & FILE_TYPE_MASK) === DIRECTORY_TYPE;
    }
}

export function statSync(file: string): Stats {
    if (getUseWsl()) {
        // Keep missing-file diagnostics stable across guest locales.
        const result = execWslSync(['env', 'LC_ALL=C', 'stat', '-L', '-c', '%f', '--', normalizeWslPath(file)]);
        if (result.code !== 0) {
            if (result.stderr.indexOf('No such file or directory') !== -1) {
                return new StatImpl(0);
            }
            throw new Error(result.stderr);
        }
        const mode = result.stdout.trim();
        if (!/^[0-9a-f]+$/i.test(mode)) {
            throw new Error('WSL stat returned an invalid file mode.');
        }
        return new StatImpl(parseInt(mode, 16));
    } else {
        return fs.statSync(file);
    }
}

export function existsSync(file: string): boolean {
    if (getUseWsl()) {
        const result = execWslSync(['test', '-e', normalizeWslPath(file)]);
        return result.code === 0;
    } else {
        return fs.existsSync(file);
    }
}

export function unlinkSync(file: string) {
    if (getUseWsl()) {
        const result = execWslSync(['rm', '-rf', '--', normalizeWslPath(file)]);
        if (result.code !== 0) {
            throw new Error(result.stderr);
        }
        return;
    }
    fs.unlinkSync(file);
}
