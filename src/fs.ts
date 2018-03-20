import * as sysfs from 'fs';

export interface FS {
    existsSync(path : string | Buffer) : boolean;
    readFile(filename : string, encoding : string, callback : (err : NodeJS.ErrnoException, data : string) => void) : void;
    readFileSync(filename : string, encoding?: string) : string| Buffer;
    writeFile(filename : string, data : any, callback? : (err : NodeJS.ErrnoException) => void) : void;
    writeFileSync(filename : string, data : any) : void;
    dirSync(path: string) : string[];
    unlinkAsync(path: string) : Promise<void>;
    existsAsync(path:string) : Promise<boolean>;
    openAsync(path:string, flags:string) : Promise<void>;
}

export const fs : FS = {
    existsSync: (path) => sysfs.existsSync(path),
    readFile: (filename, encoding, callback) => sysfs.readFile(filename, encoding, callback),
    readFileSync: (filename, encoding) => sysfs.readFileSync(filename, encoding),
    writeFile: (filename, data, callback) => sysfs.writeFile(filename, data, callback),
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
            sysfs.open(path, flags, (error, fd) => {
                if (error) {
                    reject();
                    return;
                }

                resolve();
            });
        });
    }
};
