import * as assert from 'assert';
import * as vscode from 'vscode';

import { HelmBlockMatchingProvider } from '../../src/helm.blockMatchingProvider';

let tempDocumentId = 0;

suite("HelmBlockMatchingProvider", () => {
    const provider = new HelmBlockMatchingProvider();

    suite("simple if/end blocks", () => {
        test("clicking on 'if' highlights if and end", async () => {
            const text = `{{- if .Values.enabled }}
hello
{{- end }}`;
            const document = await createHelmDocument(text);
            
            // Click on the 'if' keyword (position within the first tag)
            const position = new vscode.Position(0, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 2, "Should highlight 2 tags (if and end)");
            
            // Verify the highlighted ranges contain the correct text
            const highlightedTexts = highlights!.map(h => document.getText(h.range));
            assert.ok(highlightedTexts.some(t => t.includes('if')), "Should highlight the if tag");
            assert.ok(highlightedTexts.some(t => t.includes('end')), "Should highlight the end tag");
        });

        test("clicking on 'end' highlights if and end", async () => {
            const text = `{{- if .Values.enabled }}
hello
{{- end }}`;
            const document = await createHelmDocument(text);
            
            // Click on the 'end' keyword (line 2)
            const position = new vscode.Position(2, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 2, "Should highlight 2 tags (if and end)");
        });
    });

    suite("if/else/end blocks", () => {
        test("clicking on 'if' highlights if, else, and end", async () => {
            const text = `{{- if .Values.enabled }}
enabled
{{- else }}
disabled
{{- end }}`;
            const document = await createHelmDocument(text);
            
            const position = new vscode.Position(0, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 3, "Should highlight 3 tags (if, else, end)");
        });

        test("clicking on 'else' highlights if, else, and end", async () => {
            const text = `{{- if .Values.enabled }}
enabled
{{- else }}
disabled
{{- end }}`;
            const document = await createHelmDocument(text);
            
            const position = new vscode.Position(2, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 3, "Should highlight 3 tags (if, else, end)");
        });

        test("clicking on 'end' highlights if, else, and end", async () => {
            const text = `{{- if .Values.enabled }}
enabled
{{- else }}
disabled
{{- end }}`;
            const document = await createHelmDocument(text);
            
            const position = new vscode.Position(4, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 3, "Should highlight 3 tags (if, else, end)");
        });
    });

    suite("if/else if/else/end blocks", () => {
        test("clicking on 'if' highlights all related tags", async () => {
            const text = `{{- if eq .Values.env "prod" }}
prod config
{{- else if eq .Values.env "staging" }}
staging config
{{- else }}
dev config
{{- end }}`;
            const document = await createHelmDocument(text);
            
            const position = new vscode.Position(0, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 4, "Should highlight 4 tags (if, else if, else, end)");
        });

        test("clicking on 'else if' highlights all related tags", async () => {
            const text = `{{- if eq .Values.env "prod" }}
prod config
{{- else if eq .Values.env "staging" }}
staging config
{{- else }}
dev config
{{- end }}`;
            const document = await createHelmDocument(text);
            
            const position = new vscode.Position(2, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 4, "Should highlight 4 tags (if, else if, else, end)");
        });
    });

    suite("nested blocks", () => {
        test("clicking on outer 'if' only highlights outer block tags", async () => {
            const text = `{{- if .Values.outer }}
  {{- if .Values.inner }}
  inner content
  {{- end }}
{{- end }}`;
            const document = await createHelmDocument(text);
            
            // Click on outer if
            const position = new vscode.Position(0, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 2, "Should highlight 2 tags (outer if and outer end)");
            
            // Verify it's the outer end (line 4), not the inner end (line 3)
            const endHighlight = highlights!.find(h => document.getText(h.range).includes('end'));
            assert.ok(endHighlight, "Should find end highlight");
            assert.strictEqual(endHighlight!.range.start.line, 4, "Should highlight outer end on line 4");
        });

        test("clicking on inner 'if' only highlights inner block tags", async () => {
            const text = `{{- if .Values.outer }}
  {{- if .Values.inner }}
  inner content
  {{- end }}
{{- end }}`;
            const document = await createHelmDocument(text);
            
            // Click on inner if (line 1)
            const position = new vscode.Position(1, 7);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 2, "Should highlight 2 tags (inner if and inner end)");
            
            // Verify it's the inner end (line 3), not the outer end (line 4)
            const endHighlight = highlights!.find(h => document.getText(h.range).includes('end'));
            assert.ok(endHighlight, "Should find end highlight");
            assert.strictEqual(endHighlight!.range.start.line, 3, "Should highlight inner end on line 3");
        });

        test("nested if with else in outer block", async () => {
            const text = `{{- if .Values.outer }}
  {{- if .Values.inner }}
  inner
  {{- end }}
{{- else }}
  fallback
{{- end }}`;
            const document = await createHelmDocument(text);
            
            // Click on outer if
            const position = new vscode.Position(0, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 3, "Should highlight 3 tags (outer if, else, outer end)");
        });
    });

    suite("range blocks", () => {
        test("clicking on 'range' highlights range and end", async () => {
            const text = `{{- range .Values.items }}
- {{ . }}
{{- end }}`;
            const document = await createHelmDocument(text);
            
            const position = new vscode.Position(0, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 2, "Should highlight 2 tags (range and end)");
        });
    });

    suite("with blocks", () => {
        test("clicking on 'with' highlights with and end", async () => {
            const text = `{{- with .Values.config }}
name: {{ .name }}
{{- end }}`;
            const document = await createHelmDocument(text);
            
            const position = new vscode.Position(0, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 2, "Should highlight 2 tags (with and end)");
        });
    });

    suite("define blocks", () => {
        test("clicking on 'define' highlights define and end", async () => {
            const text = `{{- define "mytemplate" }}
content
{{- end }}`;
            const document = await createHelmDocument(text);
            
            const position = new vscode.Position(0, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 2, "Should highlight 2 tags (define and end)");
        });
    });

    suite("block blocks", () => {
        test("clicking on 'block' highlights block and end", async () => {
            const text = `{{- block "myblock" . }}
default content
{{- end }}`;
            const document = await createHelmDocument(text);
            
            const position = new vscode.Position(0, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 2, "Should highlight 2 tags (block and end)");
        });
    });

    suite("different tag formats", () => {
        test("handles {{ }} format (no dashes)", async () => {
            const text = `{{ if .Values.enabled }}
hello
{{ end }}`;
            const document = await createHelmDocument(text);
            
            const position = new vscode.Position(0, 4);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 2, "Should highlight 2 tags");
        });

        test("handles {{- -}} format (both dashes)", async () => {
            const text = `{{- if .Values.enabled -}}
hello
{{- end -}}`;
            const document = await createHelmDocument(text);
            
            const position = new vscode.Position(0, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 2, "Should highlight 2 tags");
        });

        test("handles mixed formats", async () => {
            const text = `{{- if .Values.enabled }}
hello
{{ end -}}`;
            const document = await createHelmDocument(text);
            
            const position = new vscode.Position(0, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 2, "Should highlight 2 tags");
        });
    });

    suite("cursor not on tag", () => {
        test("returns null when cursor is on plain text", async () => {
            const text = `{{- if .Values.enabled }}
hello world
{{- end }}`;
            const document = await createHelmDocument(text);
            
            // Click on "hello world" (line 1)
            const position = new vscode.Position(1, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.strictEqual(highlights, null, "Should return null when not on a control tag");
        });

        test("returns null when cursor is on a non-control template expression", async () => {
            const text = `{{- if .Values.enabled }}
{{ .Values.name }}
{{- end }}`;
            const document = await createHelmDocument(text);
            
            // Click on "{{ .Values.name }}" - this is not a control structure
            const position = new vscode.Position(1, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.strictEqual(highlights, null, "Should return null for non-control template expressions");
        });
    });

    suite("edge cases", () => {
        test("handles multiple separate blocks", async () => {
            const text = `{{- if .Values.first }}
first
{{- end }}
{{- if .Values.second }}
second
{{- end }}`;
            const document = await createHelmDocument(text);
            
            // Click on first if
            const position1 = new vscode.Position(0, 5);
            const highlights1 = await provider.provideDocumentHighlights(document, position1, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights1, "Should return highlights for first block");
            assert.strictEqual(highlights1!.length, 2, "Should highlight 2 tags");
            
            // Verify it matches the first end (line 2), not the second (line 5)
            const endHighlight = highlights1!.find(h => document.getText(h.range).includes('end'));
            assert.strictEqual(endHighlight!.range.start.line, 2, "Should match first end on line 2");
        });

        test("handles empty block", async () => {
            const text = `{{- if .Values.enabled }}{{- end }}`;
            const document = await createHelmDocument(text);
            
            const position = new vscode.Position(0, 5);
            const highlights = await provider.provideDocumentHighlights(document, position, new vscode.CancellationTokenSource().token);
            
            assert.ok(highlights, "Should return highlights");
            assert.strictEqual(highlights!.length, 2, "Should highlight 2 tags");
        });
    });
});

async function createHelmDocument(text: string): Promise<vscode.TextDocument> {
    ++tempDocumentId;
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(`untitled:temp-${tempDocumentId}.yaml`));
    const editor = await vscode.window.showTextDocument(document);
    await editor.edit((e) => e.insert(new vscode.Position(0, 0), text));
    return document;
}

