import { Dictionary } from "./utils/dictionary";

/**
 * Parse column based output which is seperated by whitespace(s) from kubectl or similar sources
 * for example, kubectl get po
 * @param lineOutput raw output with headers from kubectl or similar sources
 * @param columnSeparator a regex for the column separators
 * @return array of objects with key as column header and value
 */
export function parseLineOutput(lineOutput: string[], columnSeparator: RegExp): Dictionary<string>[] {
    const headers = lineOutput.shift();
    if (!headers) {
        return [];
    }
    const posHeaders = findPositionHeaders(headers, columnSeparator);
    const parsedHeaders = headers.toLowerCase().replace(columnSeparator, '|').split('|');
    return lineOutput.map((line) => {
        const lineInfoObject = Dictionary.of<string>();
        const bits = extractBits(line, posHeaders);
        bits.forEach((columnValue, index) => {
            lineInfoObject[parsedHeaders[index].trim()] = columnValue.trim();
        });
        return lineInfoObject;
    });
}

function findPositionHeaders(headers: string, columnSeparator: RegExp): number[] {
    const posHeaders: number[] = [];
    const parsedHeaders = headers.replace(columnSeparator, '|').split('|');
    let takenTo = 0;
    parsedHeaders.forEach((header) => {
        const headerPos = headers.indexOf(header, takenTo);
        takenTo = headerPos + header.length;
        posHeaders.push(headerPos);
    });
    return posHeaders;
}

function extractBits(value: string, positions: number[]): string[] {
    const bits: string[] = [];
    let cont = 0;
    while (positions.length > ++cont) {
        bits.push(value.substring(positions[cont - 1], positions[cont]));
    }
    bits.push(value.substring(positions[cont - 1]));
    return bits;
}
