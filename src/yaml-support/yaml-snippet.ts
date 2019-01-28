import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import fuzzysearch = require('fuzzysearch');

/// internal representation of a yaml code snippet corresponding to vscode.CompletionItemProvider
export interface CodeSnippet {
    readonly name: string;
    readonly label: string;
    readonly description: string;
    readonly body: string;
}

/**
 * A kubernetes completion provider provides yaml code snippets for kubernetes, eg: service, deployment.
 */
export class KubernetesCompletionProvider implements vscode.CompletionItemProvider {
    // storing all loaded yaml code snippets from ../../snippets folder
    private snippets: CodeSnippet[] = [];

    // default constructor
    public constructor() {
        this.loadCodeSnippets();
    }

    // provide code snippets for vscode
    public provideCompletionItems(doc: vscode.TextDocument, pos: vscode.Position) {
        const wordPos = doc.getWordRangeAtPosition(pos);
        const word = doc.getText(wordPos);

        return this.filterCodeSnippets(word).map((snippet: CodeSnippet): vscode.CompletionItem =>  {
            const item = new vscode.CompletionItem(snippet.label, vscode.CompletionItemKind.Snippet);
            item.insertText = new vscode.SnippetString(snippet.body);
            item.documentation = snippet.description;
            return item;
        });
    }

    // load yaml code snippets from ../../snippets folder
    private loadCodeSnippets(): void {
        const snippetRoot = path.join(__dirname, '../../../snippets');
        this.snippets  = fs.readdirSync(snippetRoot)
            .filter((filename: string): boolean => filename.endsWith('.yaml'))
            .map((filename: string): CodeSnippet => this.readYamlCodeSnippet(path.join(snippetRoot, filename)));
    }

    // filter all internal code snippets using the parameter word
    private filterCodeSnippets(word: string): CodeSnippet[] {
        return this.snippets.filter((snippet: CodeSnippet): boolean =>
            fuzzysearch(word.toLowerCase(), snippet.name.toLowerCase()));
    }

    // parse a yaml snippet file into a CodeSnippet
    private readYamlCodeSnippet(filename: string): CodeSnippet {
        return <CodeSnippet>yaml.safeLoad(fs.readFileSync(filename, 'utf-8'));
    }
}
