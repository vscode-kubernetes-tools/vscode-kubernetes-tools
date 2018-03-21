import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as fuzzysearch from 'fuzzysearch';

/// internal representation of a yaml code snippet corresponding to vscode.CompletionItemProvider
export interface CodeSnippet {
    readonly name : string;
    readonly label : string;
    readonly description : string;
    readonly body : string;
}


/**
 * A kubernetes completion provider provides yaml code snippets for kubernetes, eg: service, deployment.
 */
export class KubernetesCompletionProvider implements vscode.CompletionItemProvider {
    // storing all loaded yaml code snippets from ../../snippets folder
    private _snippets: CodeSnippet[] = [];

    // default constructor
    public constructor() {
        this._loadCodeSnippets();
    }

    // provide code snippets for vscode
    public provideCompletionItems(doc: vscode.TextDocument, pos: vscode.Position) {
        const wordPos = doc.getWordRangeAtPosition(pos);
        const word = doc.getText(wordPos);

        return this._filterCodeSnippets(word).map((snippet: CodeSnippet): vscode.CompletionItem =>  {
            const item = new vscode.CompletionItem(snippet.label, vscode.CompletionItemKind.Snippet);
            item.insertText = new vscode.SnippetString(snippet.body);
            item.documentation = snippet.description;
            return item;
        });
    }

    // load yaml code snippets from ../../snippets folder
    private _loadCodeSnippets(): void {
        const snippetRoot = path.join(__dirname, '../../../snippets');
        this._snippets  = fs.readdirSync(snippetRoot)
            .filter((filename: string): boolean => filename.endsWith('.yaml'))
            .map((filename: string): CodeSnippet =>
                <CodeSnippet>yaml.safeLoad(fs.readFileSync(path.join(snippetRoot, filename), 'utf-8')));
    }

    // filter all internal code snippets using the parameter word
    private _filterCodeSnippets(word: string): CodeSnippet[] {
        return this._snippets.filter((snippet: CodeSnippet): boolean =>
            fuzzysearch(word.toLowerCase(), snippet.name.toLowerCase()));
    }
}