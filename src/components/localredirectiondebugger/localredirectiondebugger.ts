import * as vscode from 'vscode';

import { LocalRedirectionDebuggerProvider } from './localredirectiondebugger.extension';

export class LocalRedirectionDebugger /* implements vscode.TreeDataProvider<CloudExplorerTreeNode>*/ {
    private readonly providers = Array.of<LocalRedirectionDebuggerProvider>();

    register(provider: LocalRedirectionDebuggerProvider): void {
        console.log(`You registered local redirection debugger type ${provider.id}`);
        this.providers.push(provider);
    }

    startLocalRedirectionDebugProvider(target?: any): void {
        // if no providers installed:
        if (this.providers.length === 0)
        {
            const browseExtensions = "Find Providers on Marketplace";
            vscode.window.showInformationMessage('You do not have a Local Redirection Debug Provider installed.', browseExtensions)
            .then((selection: string | undefined) => {
                if (selection === browseExtensions) {
                    vscode.commands.executeCommand('extension.vsKubernetesFindLocalTunnelDebugProviders');
                }
            });
            return;
        }
        // else:
        // choose a debugger
        // can use:
        //  vscode.window.showQuickPick();
        // startDebugging(target);
    };
}


