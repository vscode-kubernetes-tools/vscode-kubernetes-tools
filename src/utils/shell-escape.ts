/**
 * Utility functions for safely escaping shell arguments
 */

/**
 * Safely escape a shell argument to prevent command injection
 * @param arg The argument to escape
 * @returns The escaped argument safe for shell execution
 */
export function escapeShellArg(arg: string): string {
    // Escape single quotes by ending the quoted string, adding an escaped quote, and starting a new quoted string
    return `'${arg.replace(/'/g, "'\"'\"'")}'`;
}
