import { Shell, ShellResult } from '../../shell';
import { Errorable } from '../../errorable';

export class Git {
    constructor(private readonly shell: Shell) {}

    private async git(args: string): Promise<ShellResult> {
        const cmd = `git ${args}`;
        const sr = await this.shell.execCore(cmd, this.shell.execOpts());
        return sr;
    }

    public async whenCreated(commitId: string): Promise<string | null> {
        const sr = await this.git(`log --pretty=%ar -n 1 ${commitId}`);
        if (sr.code === 0) {
            return sr.stdout;
        }
        return null;
    }

    public async checkout(commitId: string): Promise<Errorable<null>> {
        const sr = await this.git(`checkout ${commitId}`);
        if (sr.code === 0) {
            return { succeeded: true, result: null };
        }
        return { succeeded: false, error: [ sr.stderr ] };
    }
}
