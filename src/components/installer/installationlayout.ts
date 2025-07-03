import * as os from 'os';
import * as path from 'path';

import { fs } from '../../fs';
import { Platform, Shell } from "../../shell";
import * as shelljs from 'shelljs';

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

export function platformArch(os: string) {
    // on macOS ask the kernel directly
    if (os === "darwin") {
        try {
            const arch = shelljs.exec("uname -m", { silent: true }).stdout.trim();
            return arch === "arm64" ? "arm64" : "amd64";
        } catch {
      // fall-back to Node’s process.arch
        }
    }
    if (process.arch === 'arm' && os === 'linux') {
        return 'arm';
    } else if (process.arch === 'arm64') {
        return 'arm64';
    } else {
        return 'amd64';
    }
}
