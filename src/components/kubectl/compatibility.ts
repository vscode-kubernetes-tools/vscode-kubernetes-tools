import { ShellResult } from '../../shell';

interface CompatibilityGuaranteed {
    readonly guaranteed: true;
}

interface CompatibilityNotGuaranteed {
    readonly guaranteed: false;
    readonly didCheck: boolean;
    readonly clientVersion: string;
    readonly serverVersion: string;
}

export type Compatibility = CompatibilityGuaranteed | CompatibilityNotGuaranteed;

export function isGuaranteedCompatible(c: Compatibility): c is CompatibilityGuaranteed {
    return c.guaranteed;
}

export async function check(kubectlInvokeAsync: (cmd: string) => Promise<ShellResult>): Promise<Compatibility> {
    const sr = await kubectlInvokeAsync('version --short');
    if (sr.code !== 0) {
        return {
            guaranteed: false,
            didCheck: false,
            clientVersion: '',
            serverVersion: ''
        };
    }

    const lines = sr.stdout.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const versionMappings = lines.map((l) => parseVersion(l));
    const clientVersion = versionMappings.find((m) => m[0] === 'client')[1];
    const serverVersion = versionMappings.find((m) => m[0] === 'server')[1];

    if (isCompatible(clientVersion, serverVersion)) {
        return { guaranteed: true };
    }

    return {
        guaranteed: false,
        didCheck: true,
        clientVersion: clientVersion,
        serverVersion: serverVersion
    };
}

function isCompatible(clientVersionStr: string, serverVersionStr: string): boolean {
    const clientVersion = clientVersionStr.split('.');
    const serverVersion = serverVersionStr.split('.');
    if (clientVersion[0] === serverVersion[0]) {
        const clientMinor = Number.parseInt(clientVersion[1]);
        const serverMinor = Number.parseInt(serverVersion[1]);
        if (Math.abs(clientMinor - serverMinor) <= 1) {
            return true;
        }
    }
    return false;
}

function parseVersion(versionLine: string): [string, string] {
    // Format: Xxx Version: vN.N.N
    const bits = versionLine.split(' ');
    return [bits[0].toLowerCase(), bits[bits.length - 1]];
}
