import * as vscode from 'vscode';
import opn from 'opn';

export function open(url: string) {
    // This check may be redundant now?
    if ((<any>vscode.env).openExternal) {
        vscode.env.openExternal(vscode.Uri.parse(url));
    } else {
        opn(url);
    }
}
