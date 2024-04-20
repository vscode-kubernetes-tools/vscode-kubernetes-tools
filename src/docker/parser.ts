export interface IDockerfile {
    /**
     * Parse the inherited base image from the dockerfile.
     */
    getBaseImage(): string | undefined;

    /**
     *  Parse the exposed ports from the dockerfile.
     */
    getExposedPorts(): string[];

    /**
     *  Parse the workdir from the dockerfile.
     */
    getWorkDir(): string | undefined;

    /**
     * Search the debug options from the launch command.
     */
    searchLaunchArgs(regularExpression: RegExp): RegExpMatchArray | [];
}

export interface IDockerParser {
    /**
     * Parse the docker file.
     */
    parse(filePath: string): IDockerfile;
}
