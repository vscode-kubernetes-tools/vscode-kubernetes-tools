import * as sysfs from 'fs';
import * as sysfsAsync from 'fs/promises';

export interface FS {
    chmod(path: string, mode: string | number): Promise<void>;
    existsSync(path: string | Buffer): boolean;
    readTextFile(path: string): Promise<string>;
    readFileAsync(filename: string): Promise<Buffer>;
    renameAsync(oldName: string, newName: string): Promise<void>;
    readFileSync(filename: string, encoding: BufferEncoding): string;
    readFileToBufferSync(filename: string): Buffer;
    writeFile(filename: string, data: any, callback: sysfs.NoParamCallback): void;
    writeTextFile(filename: string, text: string): Promise<void>;
    writeFileSync(filename: string, data: any): void;
    dirSync(path: string): string[];
    unlinkAsync(path: string): Promise<void>;
    existsAsync(path: string): Promise<boolean>;
    openAsync(path: string, flags: string): Promise<void>;
    statSync(path: string): sysfs.Stats;
}

export const fs: FS = {
    chmod: sysfsAsync.chmod,
    existsSync: (path) => sysfs.existsSync(path),
    readTextFile: (path) => sysfsAsync.readFile(path, { encoding: 'utf8' }),
    readFileAsync: (path) => sysfsAsync.readFile(path, null),
    readFileSync: (filename, encoding) => sysfs.readFileSync(filename, encoding),
    readFileToBufferSync: (filename) => sysfs.readFileSync(filename),
    renameAsync: sysfsAsync.rename,
    writeFile: (filename, data, callback) => sysfs.writeFile(filename, data, callback),
    writeTextFile: (filename, text) => sysfsAsync.writeFile(filename, text),
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
