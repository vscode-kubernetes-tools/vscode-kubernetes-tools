import * as path from 'path';
import { ExtensionContext, Uri } from "vscode";

let EXTENSION_CONTEXT: ExtensionContext | null = null;

export function setAssetContext(context: ExtensionContext) {
    EXTENSION_CONTEXT = context;
}

export function assetPath(relativePath: string): string {
    if (EXTENSION_CONTEXT) {  // which it always should be
        return EXTENSION_CONTEXT.asAbsolutePath(relativePath);
    }
    const absolutePath = path.join(__dirname, '..', relativePath);
    return absolutePath;
}

export function assetUri(relativePath: string): Uri {
    return Uri.file(assetPath(relativePath));
}
