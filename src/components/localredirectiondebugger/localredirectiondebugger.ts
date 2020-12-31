import * as vscode from 'vscode';

import { LocalRedirectionDebuggerProvider } from './localredirectiondebugger.extension';
import { getLocalTunnelDebugProvider } from '../config/config';

export class LocalRedirectionDebugger {
    private readonly providers = Array.of<LocalRedirectionDebuggerProvider>();

    register(provider: LocalRedirectionDebuggerProvider): void {
        console.log(`Registered local redirection debugger type ${provider.id}`);
        this.providers.push(provider);
    }

    startLocalRedirectionDebugProvider(target?: any): void {
        const browseExtensions = "Find Providers on Marketplace";
        if (this.providers.length === 0)
        {
            vscode.window.showInformationMessage('You do not have a Local Tunnel Debug Provider installed.', browseExtensions)
            .then((selection: string | undefined) => {
                if (selection === browseExtensions) {
                    vscode.commands.executeCommand('extension.vsKubernetesFindLocalTunnelDebugProviders');
                }
            });
            return;
        }

        let providerName = getLocalTunnelDebugProvider();
        if (providerName === "") {
            // If no provider is configured in the settings, take the first one that's registered
            // alphabetically
            providerName = this.providers.map((p) => p.id).sort()[0];
        }
        const providerToUse: LocalRedirectionDebuggerProvider | undefined = this.providers.find((p) => p.id === providerName);
        if (providerToUse === undefined) {
            vscode.window.showWarningMessage(`You have configured VSCode to use Local Tunnel debugger '${providerName}', but it is not installed.`, browseExtensions)
            .then((selection: string | undefined) => {
                if (selection === browseExtensions) {
                    vscode.commands.executeCommand('extension.vsKubernetesFindLocalTunnelDebugProviders');
                }
            });
            return;
        }
        providerToUse.startDebugging(target);
    };
}


