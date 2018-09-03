import { Host } from '../host';
import { Shell, ShellResult } from '../shell';
import { FS } from '../fs';
import * as syspath from 'path';
import * as binutil from '../binutil';
import { Errorable } from '../errorable';
import { getToolPath } from '../components/config/config';

export interface Draft {
    checkPresent(mode: CheckPresentMode): Promise<boolean>;
    isFolderMapped(path: string): boolean;
    packs(): Promise<string[] | undefined>;
    create(appName: string, pack: string | undefined, path: string): Promise<ShellResult>;
    up(): Promise<void>;
    version(): Promise<Errorable<string>>;
}

export function create(host: Host, fs: FS, shell: Shell, installDependenciesCallback: () => void): Draft {
    return new DraftImpl(host, fs, shell, installDependenciesCallback, false);
}

export enum CheckPresentMode {
    Alert,
    Silent,
}

interface Context {
    readonly host: Host;
    readonly fs: FS;
    readonly shell: Shell;
    readonly installDependenciesCallback: () => void;
    binFound: boolean;
    binPath: string;
}

class DraftImpl implements Draft {
    constructor(host: Host, fs: FS, shell: Shell, installDependenciesCallback: () => void, draftFound: boolean) {
        this.context = { host : host, fs : fs, shell : shell, installDependenciesCallback : installDependenciesCallback, binFound : draftFound, binPath : 'draft' };
    }

    private readonly context: Context;

    checkPresent(mode: CheckPresentMode): Promise<boolean> {
        return checkPresent(this.context, mode);
    }

    isFolderMapped(path: string): boolean {
        return isFolderMapped(this.context, path);
    }

    packs(): Promise<string[] | undefined> {
        return packs(this.context);
    }

    create(appName: string, pack: string | undefined, path: string): Promise<ShellResult> {
        return invokeCreate(this.context, appName, pack, path);
    }

    up(): Promise<void> {
        return up(this.context);
    }

    version(): Promise<Errorable<string>> {
        return version(this.context);
    }
}

async function checkPresent(context: Context, mode: CheckPresentMode): Promise<boolean> {
    if (context.binFound) {
        return true;
    }

    return await checkForDraftInternal(context, mode);
}

async function packs(context: Context): Promise<string[] | undefined> {
    if (await checkPresent(context, CheckPresentMode.Alert)) {
        const dpResult = await context.shell.exec(`${context.binPath} pack list`);
        if (dpResult.code === 0) {
            // Packs may be of the form path/to/the/actual/name
            // We also may have spurious ones under github.com/Azure/draft/{cmd|pkg}
            const packs = dpResult.stdout.split('\n')
                                         .slice(1)  // remove "Available packs" line
                                         .map((l) => l.trim())
                                         .filter((l) => l.length > 0)
                                         .filter((p) => !isSpuriousPackPath(p))
                                         .map((p) => packNameFromPath(p));

            return packs;
        }
    }

    return undefined;
}

async function invokeCreate(context: Context, appName: string, pack: string | undefined, path: string): Promise<ShellResult> {
    if (await checkPresent(context, CheckPresentMode.Alert)) {
        const packOpt = pack ? ` -p ${pack}` : '';
        const cmd = `create -a ${appName} ${packOpt} "${path}"`;
        const result = await context.shell.exec(`${context.binPath} ${cmd}`);
        if (result.code === 0 && result.stdout.indexOf('chart directory charts/ already exists') >= 0) {
            const draftManifestFile = syspath.join(path, 'draft.toml');
            const hasDraftManifest = context.fs.existsSync(draftManifestFile);
            if (!hasDraftManifest) {
                const toml = `[environments]
  [environments.development]
    name = "${appName}"
    namespace = "default"
    wait = true
    watch = false
    watch-delay = 2
    auto-connect = false
    dockerfile = ""
    chart = ""`;
                context.fs.writeFileSync(draftManifestFile, toml);
                return { code: 0, stdout: '--> skipping pack detection - chart directory charts/ already exists. Ready to sail!', stderr: '' };
            }
        }
        return result;
    }
}

async function up(context: Context): Promise<void> {
    if (await checkPresent(context, CheckPresentMode.Alert)) {
        if (context.shell.isUnix()) {
            const term = context.host.createTerminal('draft up', `bash`, [ '-c', `draft up ; bash` ]);
            term.show(true);
        } else {
            const term = context.host.createTerminal('draft up', 'powershell.exe', [ '-NoExit', `draft`, `up` ]);
            term.show(true);
        }
    }
}

async function version(context: Context): Promise<Errorable<string>> {
    if (await checkPresent(context, CheckPresentMode.Alert)) {
        const result = await context.shell.exec(`${context.binPath} version`);
        if (result.code === 0) {
            return { succeeded: true, result: result.stdout.trim() };
        }
        return { succeeded: false, error: [ result.stdout ] };
    }
    return { succeeded: false, error: [ '' ] };  // already alerted
}

async function checkForDraftInternal(context: Context, mode: CheckPresentMode): Promise<boolean> {
    const binName = 'draft';
    const bin = getToolPath(context.host, binName);

    const inferFailedMessage = `Could not find "${binName}" binary.`;
    const configuredFileMissingMessage = `${bin} does not exist!`;
    return binutil.checkForBinary(context, bin, binName, inferFailedMessage, configuredFileMissingMessage, mode === CheckPresentMode.Alert);
}

function isFolderMapped(context: Context, path: string): boolean {
    // Heuristic based on files created by 'draft create'
    const tomlFile = syspath.join(path, 'draft.toml');
    const ignoreFile = syspath.join(path, '.draftignore');
    return context.fs.existsSync(tomlFile) && context.fs.existsSync(ignoreFile);
}

function isSpuriousPackPath(path: string) {
    return path.indexOf('draft/pkg') >= 0
        || path.indexOf('draft/cmd') >= 0;
}

function packNameFromPath(path: string) {
    const parsePoint = path.lastIndexOf('/');
    return path.substring(parsePoint + 1);
}