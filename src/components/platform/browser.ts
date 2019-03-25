import * as vscode from 'vscode';
import opn = require('opn');

export function open(url: string) {
    const openExternal: any = (<any>vscode.env).openExternal ? (<any>vscode.env).openExternal : opn;
    openExternal(url);
}