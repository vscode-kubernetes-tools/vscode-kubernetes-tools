import * as fs from 'fs';
import { CommandEntry, parse as rawDockerfileParser} from 'docker-file-parser';

import { IDockerParser } from "./parser";
import { shell, ShellResult } from "../shell";

class RawDockerfile {
    private commandEntries: CommandEntry[];

    constructor(private readonly dockerfilePath: string) {
        const dockerData = fs.readFileSync(dockerfilePath, 'utf-8');
        this.commandEntries = rawDockerfileParser(dockerData, { includeComments: false });
    }

    public getCommandsOfType(...commands: string[]): CommandEntry[] {
        return this.commandEntries.filter((entry) => {
            const cmdName = entry.name.toLowerCase();
            return commands.find((key) => key === cmdName);
        });
    }

    public mergeCommandArgsOfType(command: string): string[] {
        let args = [];
        this.commandEntries.forEach((entry) => {
            if (entry.name.toLowerCase() === command) {
                args = args.concat(entry.args);
            }
        });
        return args;
    }

    public searchInArgs(regularExpression: RegExp, scope?: string[]): RegExpMatchArray {
        const scopeEntries = (scope ? this.getCommandsOfType(...scope) : this.commandEntries);
        for (const entry of scopeEntries) {
            const args = Array.isArray(entry.args) ? entry.args : [ String(entry.args) ];
            for (const arg of args) {
                const matches = arg.match(regularExpression);
                if (matches && matches.length) {
                    return matches;
                }
            }
        }

        return null;
    }
}

export class DockerfileParser implements IDockerParser {
    private readonly dockerfile;

    constructor(private readonly dockerfilePath: string) {
        this.dockerfile = new RawDockerfile(dockerfilePath);
    }

    getBaseImage(): string {
        const fromEntries = this.dockerfile.getCommandsOfType("from");
        if (fromEntries.length === 0) {
            return "";
        }
        const baseImageTag = fromEntries[0].args;
        const baseImageID = baseImageTag.split(":")[0];
        const baseImageNameParts = baseImageTag.split("/");
        return baseImageNameParts[baseImageNameParts.length - 1].toLowerCase();
    }

    getExposedPorts(): string[] {
        return this.dockerfile.mergeCommandArgsOfType("expose");
    }

    searchLaunchArgs(regularExpression: RegExp): RegExpMatchArray {
        return this.dockerfile.searchInArgs(regularExpression, ["run", "cmd", "entrypoint"]);
    }
}
