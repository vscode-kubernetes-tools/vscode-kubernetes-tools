import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

import { fs } from '../../fs';
import { Platform, Shell } from "../../shell";

export function vsKubernetesFolder(shell: Shell): string {
    const originalDir = path.join(shell.home(), `.vs-kubernetes`);

    if (fs.existsSync(originalDir) || os.platform() !== `linux`) {
        return originalDir;
    }

    let xdgStateHome = process.env.XDG_STATE_HOME || ``;
    if (xdgStateHome[0] !== `/`) {
        xdgStateHome = path.join(os.homedir(), `.local/state`);
    }
    return path.join(xdgStateHome, `vs-kubernetes`);
}

export function baseInstallFolder(shell: Shell): string {
    return path.join(vsKubernetesFolder(shell), `tools`);
}

export function getInstallFolder(shell: Shell, tool: string): string {
    return path.join(baseInstallFolder(shell), tool);
}

export function platformUrlString(platform: Platform, supported?: Platform[]): string | null {
    if (supported && supported.indexOf(platform) < 0) {
        return null;
    }
    switch (platform) {
        case Platform.Windows: return 'windows';
        case Platform.MacOS: return 'darwin';
        case Platform.Linux: return 'linux';
        default: return null;
    }
}

export function formatBin(tool: string, platform: Platform): string | null {
    const platformString = platformUrlString(platform);
    if (!platformString) {
        return null;
    }
    const platformArchString = platformArch(platformString);
    const toolPath = `${platformString}-${platformArchString}/${tool}`;
    if (platform === Platform.Windows) {
        return toolPath + '.exe';
    }
    return toolPath;
}

export function platformArch(platform: string, machine?: string): string {
    if (platform === 'darwin') {
        return (machine || darwinMachine()) === 'arm64' ? 'arm64' : 'amd64';
    }
    if (process.arch === 'arm' && platform === 'linux') {
        return 'arm';
    } else if (process.arch === 'arm64') {
        return 'arm64';
    } else {
        return 'amd64';
    }
}

function darwinMachine(): string {
    try {
        // Keep the kernel probe used for Rosetta detection without invoking a shell.
        return execFileSync('/usr/bin/uname', ['-m'], { encoding: 'utf8', windowsHide: true }).trim();
    } catch (_err) {
        return os.machine();
    }
}
