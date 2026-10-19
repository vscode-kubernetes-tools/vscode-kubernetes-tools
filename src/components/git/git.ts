import { CommandInvocation, executeCommand, ProcessResult } from '../../process';
import { Shell } from '../../shell';
import { Errorable } from '../../errorable';
import { getUseWsl } from '../config/config';

const GIT_REVISION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/;

export class Git {
    constructor(private readonly shell: Shell) {}

    private git(args: readonly string[]): Promise<ProcessResult> {
        const { cwd, env } = this.shell.execOpts();
        const invocation: CommandInvocation = getUseWsl() ? {
            executable: 'wsl.exe',
            args: ['--exec', 'git', ...args],
            cwd,
            env,
        } : {
            executable: 'git',
            args,
            cwd,
            env,
        };
        return executeCommand(invocation);
    }

    public async whenCreated(commitId: string): Promise<string | null> {
        const resolvedCommit = await this.resolveCommit(commitId);
        if (!resolvedCommit) {
            return null;
        }

        const sr = await this.git(['log', '--pretty=%ar', '-n', '1', resolvedCommit]);
        if (sr.code === 0) {
            return sr.stdout;
        }
        return null;
    }

    public async checkout(commitId: string): Promise<Errorable<null>> {
        const resolvedCommit = await this.resolveCommit(commitId);
        if (!resolvedCommit) {
            return { succeeded: false, error: [ 'Invalid Git commit ID.' ] };
        }

        const sr = await this.git(['checkout', '--detach', resolvedCommit]);
        if (sr.code === 0) {
            return { succeeded: true, result: null };
        }
        return { succeeded: false, error: [ sr.stderr ] };
    }

    private async resolveCommit(revision: string): Promise<string | undefined> {
        if (!GIT_REVISION_PATTERN.test(revision) || revision.startsWith('-') || revision.includes('..') || revision.includes('@{')) {
            return undefined;
        }
        try {
            const result = await this.git(['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`]);
            const resolved = result.stdout.trim();
            return result.code === 0 && /^[0-9a-f]{40,64}$/i.test(resolved) ? resolved : undefined;
        } catch (_err) {
            return undefined;
        }
    }
}
