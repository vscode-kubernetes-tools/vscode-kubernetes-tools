import * as vscode from 'vscode';

export class HelmBlockMatchingProvider implements vscode.DocumentHighlightProvider {
    
    // Regex to match Helm template tags with control flow keywords
    private static readonly OPENING_KEYWORDS = ['if', 'range', 'with', 'define', 'block'];
    private static readonly TEMPLATE_TAG_REGEX = /\{\{-?\s*(if|else|else\s+if|range|with|define|block|end)\b[^}]*-?\}\}/g;

    public provideDocumentHighlights(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentHighlight[]> {
        
        const text = document.getText();
        const offset = document.offsetAt(position);
        
        // Find all Helm template tags in the document
        const tags = this.findAllTags(text);
        
        // Find which tag (if any) the cursor is inside
        const currentTag = tags.find(tag => offset >= tag.start && offset <= tag.end);
        
        if (!currentTag) {
            return null;
        }
        
        // Determine if we're on an opening keyword, else, or end
        const keyword = currentTag.keyword;
        
        if (keyword === 'end') {
            // Find the matching opening tag by walking backwards with nesting awareness
            const matchingOpener = this.findMatchingOpener(tags, currentTag);
            if (matchingOpener) {
                return this.createHighlights(document, [matchingOpener, currentTag]);
            }
        } else if (keyword === 'else' || keyword.startsWith('else')) {
            // For else/else if, highlight the opening if and the end
            const { opener, closer } = this.findBlockBoundaries(tags, currentTag);
            const highlights: TagInfo[] = [currentTag];
            if (opener) { highlights.unshift(opener); }
            if (closer) { highlights.push(closer); }
            return this.createHighlights(document, highlights);
        } else if (HelmBlockMatchingProvider.OPENING_KEYWORDS.includes(keyword)) {
            // Find the matching end tag
            const matchingEnd = this.findMatchingEnd(tags, currentTag);
            if (matchingEnd) {
                return this.createHighlights(document, [currentTag, matchingEnd]);
            }
        }
        
        return null;
    }
    
    private findAllTags(text: string): TagInfo[] {
        const tags: TagInfo[] = [];
        const regex = new RegExp(HelmBlockMatchingProvider.TEMPLATE_TAG_REGEX.source, 'g');
        let match: RegExpExecArray | null;
        
        while ((match = regex.exec(text)) !== null) {
            let keyword = match[1].trim();
            // Normalize "else if" to "elseif" for easier handling
            if (keyword === 'else if' || keyword.startsWith('else ')) {
                keyword = 'elseif';
            }
            tags.push({
                keyword: keyword,
                start: match.index,
                end: match.index + match[0].length,
                fullMatch: match[0]
            });
        }
        
        return tags;
    }
    
    private findMatchingEnd(tags: TagInfo[], opener: TagInfo): TagInfo | null {
        const openerIndex = tags.indexOf(opener);
        let depth = 1;
        
        for (let i = openerIndex + 1; i < tags.length; i++) {
            const tag = tags[i];
            if (HelmBlockMatchingProvider.OPENING_KEYWORDS.includes(tag.keyword)) {
                depth++;
            } else if (tag.keyword === 'end') {
                depth--;
                if (depth === 0) {
                    return tag;
                }
            }
            // else/elseif don't affect depth, they're at the same level
        }
        
        return null;
    }
    
    private findMatchingOpener(tags: TagInfo[], closer: TagInfo): TagInfo | null {
        const closerIndex = tags.indexOf(closer);
        let depth = 1;
        
        for (let i = closerIndex - 1; i >= 0; i--) {
            const tag = tags[i];
            if (tag.keyword === 'end') {
                depth++;
            } else if (HelmBlockMatchingProvider.OPENING_KEYWORDS.includes(tag.keyword)) {
                depth--;
                if (depth === 0) {
                    return tag;
                }
            }
            // else/elseif don't affect depth
        }
        
        return null;
    }
    
    private findBlockBoundaries(tags: TagInfo[], elseTag: TagInfo): { opener: TagInfo | null, closer: TagInfo | null } {
        const elseIndex = tags.indexOf(elseTag);
        
        // Find opener by going backwards
        let depth = 1;
        let opener: TagInfo | null = null;
        for (let i = elseIndex - 1; i >= 0; i--) {
            const tag = tags[i];
            if (tag.keyword === 'end') {
                depth++;
            } else if (HelmBlockMatchingProvider.OPENING_KEYWORDS.includes(tag.keyword)) {
                depth--;
                if (depth === 0) {
                    opener = tag;
                    break;
                }
            }
        }
        
        // Find closer by going forwards
        depth = 1;
        let closer: TagInfo | null = null;
        for (let i = elseIndex + 1; i < tags.length; i++) {
            const tag = tags[i];
            if (HelmBlockMatchingProvider.OPENING_KEYWORDS.includes(tag.keyword)) {
                depth++;
            } else if (tag.keyword === 'end') {
                depth--;
                if (depth === 0) {
                    closer = tag;
                    break;
                }
            }
        }
        
        return { opener, closer };
    }
    
    private createHighlights(document: vscode.TextDocument, tags: TagInfo[]): vscode.DocumentHighlight[] {
        return tags.map(tag => {
            const startPos = document.positionAt(tag.start);
            const endPos = document.positionAt(tag.end);
            return new vscode.DocumentHighlight(
                new vscode.Range(startPos, endPos),
                vscode.DocumentHighlightKind.Read
            );
        });
    }
}

interface TagInfo {
    keyword: string;
    start: number;
    end: number;
    fullMatch: string;
}

