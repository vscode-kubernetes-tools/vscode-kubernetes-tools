import * as sysfs from 'fs';
import { promisify } from 'util';

export interface FS {
    existsSync(path: string | Buffer): boolean;
    readFile(filename: string, encoding: string, callback: (err: NodeJS.ErrnoException, data: string) => void): void;
    readTextFile(path: string): Promise<string>;
    readFileAsync(filename: string): Promise<Buffer>;
    readFileSync(filename: string, encoding: string): string;
    readFileToBufferSync(filename: string): Buffer;
    writeFile(filename: string, data: any, callback: (err: NodeJS.ErrnoException) => void): void;
    writeTextFile(filename: string, text: string): Promise<void>;
    writeFileSync(filename: string, data: any): void;
    dirSync(path: string): string[];
    unlinkAsync(path: string): Promise<void>;
    existsAsync(path: string): Promise<boolean>;
    openAsync(path: string, flags: string): Promise<void>;
    statSync(path: string): sysfs.Stats;
}

export const fs: FS = {
    existsSync: (path) => sysfs.existsSync(path),
    readFile: (filename, encoding, callback) => sysfs.readFile(filename, encoding, callback),
    readTextFile: promisify(
        (path: string, cb: (err: NodeJS.ErrnoException, data: string) => void) =>
          sysfs.readFile(path, { encoding: 'utf8' }, cb)),
    readFileAsync: promisify(
        (path: string, cb: (err: NodeJS.ErrnoException, data: Buffer) => void) =>
          sysfs.readFile(path, null, cb)),
    readFileSync: (filename, encoding) => sysfs.readFileSync(filename, encoding),
    readFileToBufferSync: (filename) => sysfs.readFileSync(filename),
    writeFile: (filename, data, callback) => sysfs.writeFile(filename, data, callback),
    writeTextFile: promisify(
        (filename: string, data: string, callback: (err: NodeJS.ErrnoException) => void) => sysfs.writeFile(filename, data, callback)),
    writeFileSync: (filename, data) => sysfs.writeFileSync(filename, data),
    dirSync: (path) => sysfs.readdirSync(path),

    unlinkAsync: (path) => {
        return new Promise((resolve, reject) => {
            sysfs.unlink(path, (error) => {
                if (error) {
                    reject();
                    return;
                }

                resolve();
            });
        });
    },

    existsAsync: (path) => {
        return new Promise((resolve) => {
            sysfs.exists(path, (exists) => {
                resolve(exists);
            });
        });
    },

    openAsync: (path, flags) => {
        return new Promise((resolve, reject) => {
            sysfs.open(path, flags, (error, _fd) => {
                if (error) {
                    reject();
                    return;
                }

                resolve();
            });
        });
    },

    statSync: (path) => sysfs.statSync(path)
};
