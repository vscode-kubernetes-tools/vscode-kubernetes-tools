import { Host } from '../host';
import { Shell, ShellResult } from '../shell';
import { FS } from '../fs';
import * as syspath from 'path';
import * as binutil from '../binutil';

export interface Draft {
    checkPresent(mode: CheckPresentMode): Promise<boolean>;
    isFolderMapped(path: string): boolean;
    packs(): Promise<string[] | undefined>;
    invoke(args: string): Promise<ShellResult>;
    up(): Promise<void>;
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

    invoke(args: string): Promise<ShellResult> {
        return invoke(this.context, args);
    }

    up(): Promise<void> {
        return up(this.context);
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
        const dhResult = await context.shell.exec(context.binPath + " home");
        if (dhResult.code === 0) {
            const draftHome = dhResult.stdout.trim();
            const draftPacksDir = syspath.join(draftHome, 'packs');
            const draftPacks = context.fs.dirSync(draftPacksDir);
            return draftPacks;
        }
    }

    return undefined;
}

async function invoke(context: Context, args: string): Promise<ShellResult> {
    if (await checkPresent(context, CheckPresentMode.Alert)) {
        const result = context.shell.exec(context.binPath + ' ' + args);
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

async function path(context: Context): Promise<string | undefined> {
    let bin = await pathCore(context);
    return binutil.execPath(context.shell, bin);
}

async function pathCore(context: Context): Promise<string | undefined> {
    if (await checkPresent(context, CheckPresentMode.Alert)) {
        return context.binPath;
    }
    return undefined;
}

async function checkForDraftInternal(context: Context, mode: CheckPresentMode): Promise<boolean> {
    const binName = 'draft';
    const bin = context.host.getConfiguration('vs-kubernetes')[`vs-kubernetes.${binName}-path`];

    const inferFailedMessage = 'Could not find "draft" binary.';
    const configuredFileMissingMessage = bin + ' does not exist!';
    return binutil.checkForBinary(context, bin, binName, inferFailedMessage, configuredFileMissingMessage, mode === CheckPresentMode.Alert);
}

function isFolderMapped(context: Context, path: string): boolean {
    // Heuristic based on files created by 'draft create'
    const tomlFile = syspath.join(path, 'draft.toml');
    const ignoreFile = syspath.join(path, '.draftignore');
    return context.fs.existsSync(tomlFile) && context.fs.existsSync(ignoreFile);
}