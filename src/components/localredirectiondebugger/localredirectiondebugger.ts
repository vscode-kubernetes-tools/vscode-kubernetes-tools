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

        let providerToUse: LocalRedirectionDebuggerProvider | null = null;
        const providerName = getLocalTunnelDebugProvider();
        if (providerName === "") {
            // If no provider is configured in the settings, take the first one that's registered
            // alphabetically
            providerToUse = this.providers.sort((p1, p2): number => {
                if (p1.id < p2.id) { return -1; }
                if (p1.id > p2.id) { return 1; }
                return 0;
            })[0];
        }
        else {
            const provider = this.providers.find((p) => p.id === providerName);
            if (provider === undefined) {
                // TODO: make this smarter / add the option to edit the configuration
                vscode.window.showWarningMessage(`You have configured VSCode to use Local Tunnel debugger '${providerName}', but it is not installed.`, browseExtensions)
                .then((selection: string | undefined) => {
                    if (selection === browseExtensions) {
                        vscode.commands.executeCommand('extension.vsKubernetesFindLocalTunnelDebugProviders');
                    }
                });
                return;
            }
            providerToUse = provider;
        }

        providerToUse.startDebugging(target);
    };
}


