import * as vscode from "vscode";
import * as querystring from "querystring";
import { Kubectl } from "./kubectl";

/// a kubernetes content provider provides json content for kubernetes resources
export class KubernetesDocumentProvider implements vscode.TextDocumentContentProvider {
    public constructor(private kubectl: Kubectl) {

    }

    async provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> {
        if (uri.authority !== 'loadkubernetescore') {
            vscode.window.showErrorMessage('Unrecognized operation: ' + uri.authority);
            return `Unrecognized operation: ${uri.authority}`;
        }
        const value = querystring.parse(uri.query).value;
        if (!value) {
            vscode.window.showErrorMessage(`Missing required value in uri: ${uri}`);
            return `Missing required value in uri: ${uri}`;
        }


        const shellResult = await this.kubectl.invokeAsyncWithProgress(" -o json get " + value, `Loading ${value}...`);

        if (shellResult.code !== 0) {
            vscode.window.showErrorMessage('Get command failed: ' + shellResult.stderr);
            return shellResult.stderr;
        } else {
            return shellResult.stdout;
        }
    }
}