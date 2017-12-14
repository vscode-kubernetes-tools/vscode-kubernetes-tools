import { Shell } from './shell';
import { Host } from './host';
import { FS } from './fs';

export interface BinCheckContext {
    readonly host : Host;
    readonly fs : FS;
    readonly shell : Shell;
    binFound : boolean;
    binPath : string;
}

interface FindBinaryResult {
    err : number | null;
    output : string;
}

async function findBinary(shell : Shell, binName : string) : Promise<FindBinaryResult> {
    let cmd = `which ${binName}`;

    if (shell.isWindows()) {
        cmd = `where.exe ${binName}.exe`;
    }

    const opts = {
        async: true,
        env: {
            HOME: process.env.HOME,
            PATH: process.env.PATH
        }
    };

    const execResult = await shell.execCore(cmd, opts);
    if (execResult.code) {
        return { err: execResult.code, output: execResult.stderr };
    }

    return { err: null, output: execResult.stdout };
}

export function execPath(shell : Shell, basePath : string) : string {
    let bin = basePath;
    if (shell.isWindows() && bin && !(bin.endsWith('.exe'))) {
        bin = bin + '.exe';
    }
    return bin;
}

type CheckPresentFailureReason = 'inferFailed' | 'configuredFileMissing';

function alertNoBin(host : Host, binName : string, failureReason : CheckPresentFailureReason, message : string) : void {
    switch (failureReason) {
        case 'inferFailed':
            host.showErrorMessage(message, 'Learn more').then(
                (str) => {
                    if (str !== 'Learn more') {
                        return;
                    }

                    host.showInformationMessage(`Add ${binName} directory to path, or set "vs-kubernetes.${binName}-path" config to ${binName} binary.`);
                }
            );
            break;
        case 'configuredFileMissing':
            host.showErrorMessage(message);
            break;
    }
}

export async function checkForBinary(context : BinCheckContext, bin : string, binName : string, inferFailedMessage : string, configuredFileMissingMessage : string) : Promise<boolean> {
    if (!bin) {
        const fb = await findBinary(context.shell, binName);

        if (fb.err || fb.output.length === 0) {
            alertNoBin(context.host, binName, 'inferFailed', inferFailedMessage);
            return false;
        }

        context.binFound = true;

        return true;
    }

    context.binFound = context.fs.existsSync(bin);
    
    if (context.binFound) {
        context.binPath = bin;
    } else {
        alertNoBin(context.host, binName, 'configuredFileMissing', configuredFileMissingMessage);
    }

    return context.binFound;
}
