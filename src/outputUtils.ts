/**
 * Parse column based output which is seperated by whitespace(s) from kubectl or similar sources
 * for example, kubectl get po
 * @param lineOutput raw output with headers from kubectl or similar sources
 * @param parsingRegex a regex for the column separators
 * @return array of objects with key as column header and value
 */
export function parseLineOutput(lineOutput: string[], parsingRegex: RegExp): { [key: string]: string }[] {
    const headers = lineOutput.shift();
    if (!headers) {
        return [];
    }
    const parsedHeaders = headers.toLowerCase().replace(parsingRegex, '|').split('|');
    return lineOutput.map((line) => {
        const lineInfoObject = {};
        const bits = line.replace(parsingRegex, '|').split('|');
        bits.forEach((columnValue, index) => {
            lineInfoObject[parsedHeaders[index].trim()] = columnValue.trim();
        });
        return lineInfoObject;
    });
}
