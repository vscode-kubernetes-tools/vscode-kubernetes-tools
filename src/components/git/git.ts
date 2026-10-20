import * as path from 'path';
import { Shell } from '../../shell';
import { Errorable } from '../../errorable';
import { CommandInvocation, executeCommand, ProcessResult } from '../../process';
import { getUseWsl } from '../config/config';

const IMAGE_TAG_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;

function isValidImageTag(value: string): boolean {
    const match = IMAGE_TAG_PATTERN.exec(value);
    return match !== null && match[0] === value;
}

function isFullGitObjectId(value: string): boolean {
    return (value.length === 40 || value.length === 64) && !/[^0-9a-f]/i.test(value);
}

function wslExecutable(): string | undefined {
    const windowsDirectory = process.env.SystemRoot || process.env.WINDIR;
    return windowsDirectory && path.win32.isAbsolute(windowsDirectory) ?
        path.win32.join(windowsDirectory, 'System32', 'wsl.exe') :
        undefined;
}

function environmentPath(env: NodeJS.ProcessEnv): string | undefined {
    if (process.platform !== 'win32') {
        return env.PATH;
    }
    const pathName = Object.keys(env).find((name) => name.toLowerCase() === 'path');
    return pathName ? env[pathName] : undefined;
}

function normalisedPath(value: string): string {
    const resolved = path.resolve(value);
    return process.platform === 'win32' || process.platform === 'darwin' ? resolved.toLowerCase() : resolved;
}

function isWithinPath(parent: string, child: string): boolean {
    const relative = path.relative(parent, child);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function hostGitExecutable(shell: Shell, cwd: string | undefined, env: NodeJS.ProcessEnv): string | undefined {
    const executable = shell.which(process.platform === 'win32' ? 'git.exe' : 'git')?.trim();
    if (!executable || !path.isAbsolute(executable)) {
        return undefined;
    }
    if (process.platform === 'win32' && path.extname(executable).toLowerCase() !== '.exe') {
        return undefined;
    }

    const executableDirectory = normalisedPath(path.dirname(executable));
    const trustedPathEntry = environmentPath(env)?.split(path.delimiter).some((entry) =>
        entry.length > 0 && path.isAbsolute(entry) && path.dirname(entry) !== entry && normalisedPath(entry) === executableDirectory
    );
    if (!trustedPathEntry) {
        return undefined;
    }

    const candidate = normalisedPath(executable);
    const workingDirectories = [cwd, process.cwd()].filter((value): value is string =>
        !!value && path.isAbsolute(value) && path.dirname(value) !== value
    );
    return workingDirectories.some((workingDirectory) => isWithinPath(normalisedPath(workingDirectory), candidate)) ?
        undefined : executable;
}

export function gitRevisionFromImage(image: string): string | undefined {
    if (image.includes('@')) {
        return undefined;
    }
    const lastSlash = Math.max(image.lastIndexOf('/'), image.lastIndexOf('\\'));
    const tagSeparator = image.lastIndexOf(':');
    if (tagSeparator <= lastSlash || tagSeparator === image.length - 1) {
        return undefined;
    }
    const imageName = image.substring(lastSlash + 1, tagSeparator);
    const revision = image.substring(tagSeparator + 1);
    return imageName.length > 0 && !imageName.includes(':') && isValidImageTag(revision) ? revision : undefined;
}

export class Git {
    constructor(private readonly shell: Shell) {}

    private async git(args: readonly string[]): Promise<ProcessResult | undefined> {
        try {
            const { cwd, env } = this.shell.execOpts();
            const useWsl = getUseWsl();
            const executable = useWsl ? wslExecutable() : hostGitExecutable(this.shell, cwd, env);
            if (!executable) {
                return undefined;
            }
            const invocation: CommandInvocation = useWsl ? {
                executable,
                args: ['--exec', '/usr/bin/git', ...args],
                cwd,
            } : {
                executable,
                args,
                cwd,
                env,
            };
            return await executeCommand(invocation);
        } catch (_err) {
            return undefined;
        }
    }

    public async resolveCommit(revision: string): Promise<Errorable<string>> {
        if (!isValidImageTag(revision)) {
            return { succeeded: false, error: ['The image tag is not a valid Git revision.'] };
        }
        const result = await this.git([
            '-c', 'core.warnAmbiguousRefs=true',
            'rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`
        ]);
        if (!result) {
            return { succeeded: false, error: ['Unable to find or run Git.'] };
        }
        const stderr = result.stderr.trim();
        if (result.code !== 0) {
            return { succeeded: false, error: [stderr || 'The image tag does not identify a Git commit.'] };
        }
        if (stderr) {
            return { succeeded: false, error: [stderr] };
        }
        const resolved = result.stdout.trim();
        return isFullGitObjectId(resolved) ?
            { succeeded: true, result: resolved } :
            { succeeded: false, error: ['Git returned an invalid commit ID.'] };
    }

    public async whenCreated(resolvedCommit: string): Promise<string | null> {
        if (!isFullGitObjectId(resolvedCommit)) {
            return null;
        }
        const sr = await this.git(['log', '--pretty=%ar', '-n', '1', `${resolvedCommit}^{commit}`]);
        if (sr && sr.code === 0) {
            return sr.stdout;
        }
        return null;
    }

    public async checkout(resolvedCommit: string): Promise<Errorable<null>> {
        if (!isFullGitObjectId(resolvedCommit)) {
            return { succeeded: false, error: ['The Git commit ID is not valid.'] };
        }
        const sr = await this.git(['checkout', '--detach', `${resolvedCommit}^{commit}`]);
        if (sr && sr.code === 0) {
            return { succeeded: true, result: null };
        }
        return { succeeded: false, error: [sr?.stderr.trim() || 'Unable to run Git.'] };
    }
}
