import * as fs from 'fs';
import { CommandEntry, parse } from 'docker-file-parser';

import { IDockerfile, IDockerParser } from "./parser";

class RawDockerfile {
    private readonly commandEntries: CommandEntry[];
    private readonly dockerfilePath: string;

    constructor(filePath: string) {
        this.dockerfilePath = filePath;
        const dockerData = fs.readFileSync(this.dockerfilePath, 'utf-8');
        this.commandEntries = parse(dockerData, { includeComments: false });
    }

    public getCommandsOfType(...commands: string[]): CommandEntry[] {
        return this.commandEntries.filter((entry) => {
            const cmdName = entry.name.toLowerCase();
            return commands.find((command) => command === cmdName);
        });
    }

    public mergeCommandArgsOfType(command: string): string[] {
        let args = Array.of<string>();
        this.commandEntries.forEach((entry) => {
            if (entry.name.toLowerCase() === command) {
                args = args.concat(argArray(entry));
            }
        });
        return args;
    }

    public searchInArgs(regularExpression: RegExp, commands?: string[]): RegExpMatchArray | [] {
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
    private readonly dockerfilePath: string;

    constructor(filePath: string) {
        this.dockerfilePath = filePath;
        this.dockerfile = new RawDockerfile(this.dockerfilePath);
    }

    getBaseImage(): string | undefined {
        const fromEntries = this.dockerfile.getCommandsOfType("from");
        if (fromEntries.length === 0) {
            return undefined;
        }
        const baseImageTag = String(fromEntries[0].args);
        const baseImageNameParts = baseImageTag.split("/");
        return baseImageNameParts[baseImageNameParts.length - 1].toLowerCase();
    }

    getExposedPorts(): string[] {
        return this.dockerfile.mergeCommandArgsOfType("expose");
    }

    getWorkDir(): string | undefined {
        const workDirEntry = this.dockerfile.getCommandsOfType("workdir");
        if (workDirEntry.length === 0) {
            return undefined;
        }
        return String(workDirEntry[0].args);
    }

    searchLaunchArgs(regularExpression: RegExp): RegExpMatchArray | [] {
        return this.dockerfile.searchInArgs(regularExpression, ["run", "cmd", "entrypoint"]);
    }
}

export class DockerfileParser implements IDockerParser {
    parse(dockerfilePath: string): IDockerfile {
        return new Dockerfile(dockerfilePath);
    }
}

function argArray(entry: CommandEntry): string[] {
    const args = entry.args;
    if (Array.isArray(args)) {
        return args;
    }
    if (typeof args === 'string' || args instanceof String) {
        return [args as string];
    }
    return Object.keys(args).map((k) => `${k} ${args[k]}`);
}
