export interface ParsedCommandLine {
    readonly succeeded: true;
    readonly args: string[];
}

export interface InvalidCommandLine {
    readonly succeeded: false;
    readonly error: string;
}

export type CommandLineParseResult = ParsedCommandLine | InvalidCommandLine;

// This parser exists only for the released v1 APIs, whose contract accepts one string.
// It supports portable quoting but deliberately rejects shell control operators.
export function parseCommandLine(command: string): CommandLineParseResult {
    const args: string[] = [];
    let current = '';
    let quote: 'single' | 'double' | undefined;
    let tokenStarted = false;

    for (let index = 0; index < command.length; index++) {
        const character = command[index];

        if (character === '\0' || character === '\r' || character === '\n') {
            return invalid('Control characters are not supported.');
        }

        if (!quote && /\s/.test(character)) {
            if (tokenStarted) {
                args.push(current);
                current = '';
                tokenStarted = false;
            }
            continue;
        }

        if (!quote && [';', '&', '|', '<', '>', '`'].includes(character)) {
            return invalid('Shell operators are not supported.');
        }

        if (character === "'" && quote !== 'double') {
            quote = quote === 'single' ? undefined : 'single';
            tokenStarted = true;
            continue;
        }

        if (character === '"' && quote !== 'single') {
            quote = quote === 'double' ? undefined : 'double';
            tokenStarted = true;
            continue;
        }

        if (character === '\\' && quote !== 'single') {
            const next = command[index + 1];
            const escapable = next === '\\' || next === '"' || (!quote && !!next && /\s/.test(next));
            if (escapable) {
                current += next;
                tokenStarted = true;
                index++;
                continue;
            }
        }

        current += character;
        tokenStarted = true;
    }

    if (quote) {
        return invalid('Unterminated quoted argument.');
    }
    if (tokenStarted) {
        args.push(current);
    }
    if (args.length === 0) {
        return invalid('The command must contain at least one argument.');
    }
    return { succeeded: true, args };
}

function invalid(error: string): InvalidCommandLine {
    return { succeeded: false, error };
}
