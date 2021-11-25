import * as vscode from 'vscode';

export function shouldProvideSchemaFor(document: vscode.TextDocument): boolean {
    const overrideAnnotationText = findOverrideAnnotation(document);
    if (overrideAnnotationText) {
        const overrideAnnotation = parseOverrideAnnotation(overrideAnnotationText);
        if (overrideAnnotation.exclude) {
            return false;
        } else if (overrideAnnotation.include) {
            return true;
        }
    }
    return inferShouldProvideSchemaFor(document);
}

// Just makes calling code a bit more readable
export function shouldSkip(document: vscode.TextDocument): boolean {
    return !shouldProvideSchemaFor(document);
}

interface OverrideAnnotation {
    readonly exclude?: boolean;
    readonly include?: boolean;
}

function inferShouldProvideSchemaFor(_document: vscode.TextDocument): boolean {
    // In future we may want to be smarter, e.g. detecting things which look like Kustomize
    // patch files.  For now, though, just assume that if it's matched our global document
    // selector (and doesn't have any override comments) then it's in.
    return true;
}

function findOverrideAnnotation(document: vscode.TextDocument): string | undefined {
    for (const line of leadingComments(document)) {
        const match = line.match(/#\s*vscode-kubernetes-tools:\s*(.+)/);
        if (match && match.length >= 2) {
            return match[1];
        }
    }
    return undefined;
}

function parseOverrideAnnotation(text: string): OverrideAnnotation {
    // In future the parser may need to change to check containment instead
    // of equality. But keeping it simple for now.
    if (text === 'exclude') {
        return { exclude: true };
    } else if (text === 'include') {
        return { include: true };
    } else {
        return {};
    }
}

function* leadingComments(document: vscode.TextDocument): IterableIterator<string> {
    for (let i = 0; i < document.lineCount; ++i) {
        const line = document.lineAt(i);
        if (!line) {
            return;  // shouldn't happen but just in case
        }
        const lineText = line.text.trim();
        if (lineText.startsWith("#")) {
            yield lineText;
        } else if (lineText.length === 0) {
            continue;
        } else {
            return;
        }
    }
}
