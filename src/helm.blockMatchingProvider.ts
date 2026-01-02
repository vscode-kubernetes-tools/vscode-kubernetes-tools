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
            // Find the matching opening tag and highlight all related tags
            const matchingOpener = this.findMatchingOpener(tags, currentTag);
            if (matchingOpener) {
                const blockTags = this.findBlockTags(tags, matchingOpener);
                return this.createHighlights(document, blockTags);
            }
        } else if (keyword === 'else' || keyword === 'elseif') {
            // For else/else if, find the opening tag and highlight all related tags
            const opener = this.findMatchingOpener(tags, currentTag);
            if (opener) {
                const blockTags = this.findBlockTags(tags, opener);
                return this.createHighlights(document, blockTags);
            }
        } else if (HelmBlockMatchingProvider.OPENING_KEYWORDS.includes(keyword)) {
            // Find the matching end tag and any intermediate else/elseif tags
            const blockTags = this.findBlockTags(tags, currentTag);
            if (blockTags.length > 0) {
                return this.createHighlights(document, blockTags);
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
    
    /**
     * Find all tags in a block: opener, any intermediate else/elseif, and end.
     */
    private findBlockTags(tags: TagInfo[], opener: TagInfo): TagInfo[] {
        const openerIndex = tags.indexOf(opener);
        const blockTags: TagInfo[] = [opener];
        let depth = 1;
        
        for (let i = openerIndex + 1; i < tags.length; i++) {
            const tag = tags[i];
            if (HelmBlockMatchingProvider.OPENING_KEYWORDS.includes(tag.keyword)) {
                depth++;
            } else if (tag.keyword === 'end') {
                depth--;
                if (depth === 0) {
                    blockTags.push(tag);
                    return blockTags;
                }
            } else if ((tag.keyword === 'else' || tag.keyword === 'elseif') && depth === 1) {
                // Only include else/elseif at the same nesting level
                blockTags.push(tag);
            }
        }
        
        return blockTags;
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

