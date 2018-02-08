export interface IDockerParser {
    /**
     * Parse the inherited base image from the dockerfile.
     */
    getBaseImage(): string;

    /**
     *  Parse the exposed ports from the dockerfile.
     */
    getExposedPorts(): string[];

    /**
     * Search the debug options from the launch command.
     */
    searchLaunchArgs(regularExpression: RegExp): RegExpMatchArray;
}
