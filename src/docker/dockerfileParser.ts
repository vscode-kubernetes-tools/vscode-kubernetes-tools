import * as fs from 'fs';
import { CommandEntry, parse } from 'docker-file-parser';

import { IDockerfile, IDockerParser } from "./parser";

class RawDockerfile {
    private readonly commandEntries: CommandEntry[];

    constructor(private readonly dockerfilePath: string) {
        const dockerData = fs.readFileSync(dockerfilePath, 'utf-8');
        this.commandEntries = parse(dockerData, { includeComments: false });
    }

    public getCommandsOfType(...commands: string[]): CommandEntry[] {
        return this.commandEntries.filter((entry) => {
            const cmdName = entry.name.toLowerCase();
            return commands.find((command) => command === cmdName);
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

    public searchInArgs(regularExpression: RegExp, commands?: string[]): RegExpMatchArray {
        const commandEntries = (commands ? this.getCommandsOfType(...commands) : this.commandEntries);
        for (const entry of commandEntries) {
            const args = Array.isArray(entry.args) ? entry.args : [ String(entry.args) ];
            for (const arg of args) {
                const matches = arg.match(regularExpression);
                if (matches && matches.length) {
                    return matches;
                }
            }
        }

        return [];
    }
}

class Dockerfile implements IDockerfile {
    private readonly dockerfile: RawDockerfile;

    constructor(private readonly dockerfilePath: string) {
        this.dockerfile = new RawDockerfile(dockerfilePath);
    }

    getBaseImage(): string {
        const fromEntries = this.dockerfile.getCommandsOfType("from");
        if (fromEntries.length === 0) {
            return;
        }
        const baseImageTag = String(fromEntries[0].args);
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

export class DockerfileParser implements IDockerParser {
    parse(dockerfilePath: string): IDockerfile {
        return new Dockerfile(dockerfilePath);
    }
}
