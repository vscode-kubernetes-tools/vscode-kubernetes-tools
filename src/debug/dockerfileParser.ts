import * as fs from 'fs';
import { CommandEntry, parse as rawDockerfileParser} from 'docker-file-parser';

import { IDockerParser } from "./debugInterfaces";
import { shell, ShellResult } from "../shell";

interface IRawDockerfile {
    getCommandEntries(commands: string[]): CommandEntry[];
    getCommandArgs(command: string): string[];
    searchInArgs(regularExpression: RegExp, scope?: string[]): RegExpMatchArray;
}

class RawDockerfile implements IRawDockerfile {
    private commandEntries: CommandEntry[];

    constructor(private readonly dockerfilePath: string) {
        const dockerData = fs.readFileSync(dockerfilePath, 'utf-8');
        this.commandEntries = rawDockerfileParser(dockerData, { includeComments: false });
    }

    public getCommandEntries(commands: string[]): CommandEntry[] {
        const targetEntries = [];
        this.commandEntries.forEach((entry) => {
            const cmdName = entry.name.toLowerCase();
            if (commands.find((key) => key === cmdName)) {
                targetEntries.push(entry);
            }
        });
        return targetEntries;
    }

    public getCommandArgs(command: string): string[] {
        let args = [];
        this.commandEntries.forEach((entry) => {
            if (entry.name.toLowerCase() === command) {
                args = args.concat(entry.args);
            }
        });
        return args;
    }

    public searchInArgs(regularExpression: RegExp, scope?: string[]): RegExpMatchArray {
        const scopeEntries = (scope ? this.getCommandEntries(scope) : this.commandEntries);
        for (let entry of scopeEntries) {
            const args = Array.isArray(entry.args) ? entry.args : [ String(entry.args) ];
            for (let arg of args) {
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
    readonly dockerfile: IRawDockerfile;

    constructor(private readonly dockerfilePath: string) {
        this.dockerfile = new RawDockerfile(dockerfilePath);
    }

    getBaseImage(): string {
        const fromEntries = this.dockerfile.getCommandEntries(["from"]);
        const baseImagePaths = ((fromEntries.length ? String(fromEntries[0].args) : "").split(":")[0]).split("/");
        return baseImagePaths[baseImagePaths.length - 1].toLowerCase();
    }

    getExposedPorts(): string[] {
        return this.dockerfile.getCommandArgs("expose");
    }

    searchLaunchArgs(regularExpression: RegExp): RegExpMatchArray {
        return this.dockerfile.searchInArgs(regularExpression, ["run", "cmd", "entrypoint"]);
    }
}
