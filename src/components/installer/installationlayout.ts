import * as path from 'path';

import { Platform, Shell } from "../../shell";

export function baseInstallFolder(shell: Shell): string {
    return path.join(shell.home(), `.vs-kubernetes/tools`);
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

export function platformArch(os: string) {
    if (process.arch === 'arm' && os === 'linux') {
        return 'arm';
    } else if (process.arch === 'arm64') {
        return 'arm64';
    } else {
        return 'amd64';
    }
}
