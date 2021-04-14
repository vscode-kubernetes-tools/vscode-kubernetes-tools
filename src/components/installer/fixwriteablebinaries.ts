// We had an issue where we were installing binaries with excessively permissive
// permissions.  We no longer do this, but older installations may have existing
// files lying around.  This module checks for such files and fixes their permissions.

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import { Shell } from "../../shell";
import { Dictionary } from '../../utils/dictionary';
import { baseInstallFolder } from "./installationlayout";

const MITIGATIONS_FILE = 'mitigations.json';

export async function fixOldInstalledBinaryPermissions(shell: Shell): Promise<void> {
    if (!shell.isUnix()) {
        return;
    }
    if (isMitigated(shell)) {
        return;
    }

    try {
        await fixAllBinaryPermissions(baseInstallFolder(shell));
        recordMitigated(shell);
    } catch (e) {
        // don't bubble this up to the top level
        console.warn(`Error trying to update permissions to installed binaries: ${e}`);
    }

}

const chmod = promisify(fs.chmod);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

async function fixAllBinaryPermissions(folder: string): Promise<void> {
    const entries = (await readdir(folder)).map((e) => path.join(folder, e));
    for (const entry of entries) {
        const info = await stat(entry);
        if (info.isDirectory()) {
            await fixAllBinaryPermissions(entry);
        } else if (info.isFile()) {
            if ((info.mode & 0o777) === 0o777) {
                await chmod(entry, 0o755);
            }
        }
    }
}

function readMitigations(shell: Shell): Dictionary<any> {
    const mitigationsFile = path.join(baseInstallFolder(shell), MITIGATIONS_FILE);
    if (!fs.existsSync(mitigationsFile)) {
        return {};
    }
    const mitigationsJSON = fs.readFileSync(mitigationsFile, { encoding: 'utf8' });
    try {
        return JSON.parse(mitigationsJSON);
    } catch {
        return {};
    }
}

function writeMitigations(shell: Shell, value: Dictionary<any>): void {
    const mitigationsFile = path.join(baseInstallFolder(shell), MITIGATIONS_FILE);
    try {
        fs.writeFileSync(mitigationsFile, JSON.stringify(value, undefined, 2));
    } catch (e) {
        // swallow errors - just means we will recheck next startup
        console.log(`Failed to record mitigation: ${e}`);
    }
}

function isMitigated(shell: Shell): boolean {
    const mitigations = readMitigations(shell);
    return !!mitigations && !!mitigations['permissions'];
}

function recordMitigated(shell: Shell): void {
    const mitigations = readMitigations(shell);
    mitigations['permissions'] = true;
    writeMitigations(shell, mitigations);
}
