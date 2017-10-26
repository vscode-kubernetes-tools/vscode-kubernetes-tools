import * as sysfs from 'fs';

export interface FS {
    existsSync(path : string | Buffer) : boolean;
    readFile(filename : string, encoding : string, callback : (err : NodeJS.ErrnoException, data : string) => void) : void;
    readFileSync(filename : string, encoding : string) : string;
    writeFile(filename : string, data : any, callback? : (err : NodeJS.ErrnoException) => void) : void;
    writeFileSync(filename : string, data : any) : void;
    dirSync(path: string) : string[];
}

export const fs : FS = {
    existsSync: (path) => sysfs.existsSync(path),
    readFile: (filename, encoding, callback) => sysfs.readFile(filename, encoding, callback),
    readFileSync: (filename, encoding) => sysfs.readFileSync(filename, encoding),
    writeFile: (filename, data, callback) => sysfs.writeFile(filename, data, callback),
    writeFileSync: (filename, data) => sysfs.writeFileSync(filename, data),
    dirSync: (path) => sysfs.readdirSync(path),
};
