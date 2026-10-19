import * as config from './components/config/config';
import { Shell } from './shell';
import { Host } from './host';
import { FS } from './fs';
import { executeCommand } from './process';

export interface BinCheckContext {
    readonly host: Host;
    readonly fs: FS;
    readonly shell: Shell;
    binFound: boolean;
    binPath: string;
}

interface FindBinaryResult {
    err: number | null;
    output: string;
}

async function findBinary(shell: Shell, binName: string): Promise<FindBinaryResult> {
    let executable = 'which';
    let args = [binName];
    if (config.getUseWsl()) {
        executable = 'wsl.exe';
        args = ['--exec', 'which', binName];
    } else if (shell.isWindows()) {
        executable = 'where.exe';
        args = [`${binName}.exe`];
    }

    const opts = shell.execOpts();
    let execResult;
    try {
        execResult = await executeCommand({
            executable,
            args,
            cwd: opts.cwd,
            env: opts.env,
        });
    } catch (err) {
        return { err: -1, output: String(err) };
    }
    if (execResult.code) {
        return { err: execResult.code, output: execResult.stderr };
    }

    const resolvedPath = execResult.stdout.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() || '';
    return { err: null, output: resolvedPath };
}

export function execPath(shell: Shell, basePath: string): string {
    let bin = basePath;
    const hasDirectory = /[\\/]/.test(bin);
    if (shell.isWindows() && hasDirectory && bin && !/\.[^\\/]+$/i.test(bin)) {
        bin = `${bin}.exe`;
    }
    return bin;
}

type CheckPresentFailureReason = 'inferFailed' | 'configuredFileMissing';

function alertNoBin(host: Host, binName: string, failureReason: CheckPresentFailureReason, message: string): void {
    switch (failureReason) {
        case 'inferFailed':
            host.showErrorMessage(message, 'Install dependencies', 'Learn more').then(
                (str) => {
                    switch (str) {
                        case 'Learn more':
                            host.showInformationMessage(`Add ${binName} directory to path, or set "vs-kubernetes.${binName}-path" config to ${binName} binary.`);
                            break;
                        case 'Install dependencies':
                            void import('./components/installer/installdependencies').then((installer) => installer.installDependencies());
                            break;
                    }

                }
            );
            break;
        case 'configuredFileMissing':
            host.showErrorMessage(message, 'Install dependencies').then(
                (str) => {
                    if (str === 'Install dependencies') {
                        void import('./components/installer/installdependencies').then((installer) => installer.installDependencies());
                    }
                }
            );
            break;
    }
}

export async function checkForBinary(context: BinCheckContext, bin: string | undefined, binName: string, inferFailedMessage: string, configuredFileMissingMessage: string, alertOnFail: boolean): Promise<boolean> {
    if (!bin) {
        const fb = await findBinary(context.shell, binName);

        if (fb.err || fb.output.length === 0) {
            if (alertOnFail) {
                alertNoBin(context.host, binName, 'inferFailed', inferFailedMessage);
            }
            return false;
        }

        context.binFound = true;
        context.binPath = fb.output;

        return true;
    }

    if (!config.getUseWsl()) {
        context.binFound = context.fs.existsSync(bin);
    } else {
        const opts = context.shell.execOpts();
        try {
            const sr = await executeCommand({
                executable: 'wsl.exe',
                args: ['--exec', 'test', '-e', bin],
                cwd: opts.cwd,
                env: opts.env,
            });
            context.binFound = sr.code === 0;
        } catch (_err) {
            context.binFound = false;
        }
    }
    if (context.binFound) {
        context.binPath = bin;
    } else {
        if (alertOnFail) {
            alertNoBin(context.host, binName, 'configuredFileMissing', configuredFileMissingMessage);
        }
    }

    return context.binFound;
}
