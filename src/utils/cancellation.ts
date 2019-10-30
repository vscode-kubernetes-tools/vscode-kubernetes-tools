import * as vscode from 'vscode';

export function dummyToken(): vscode.CancellationToken {
    return (new vscode.CancellationTokenSource()).token;
}
