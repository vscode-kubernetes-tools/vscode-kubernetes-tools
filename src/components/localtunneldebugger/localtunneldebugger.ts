import * as vscode from 'vscode';

import { LocalTunnelDebugProvider } from './localtunneldebugger.extension';
import { getLocalTunnelDebugProvider } from '../config/config';

export class LocalTunnelDebugger {
    private readonly providers = Array.of<LocalTunnelDebugProvider>();

    register(provider: LocalTunnelDebugProvider): void {
        console.log(`Registered local tunnel debugger type ${provider.id}`);
        this.providers.push(provider);
    }

    startLocalTunnelDebugProvider(target?: any): void {
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

        let providerName: string = getLocalTunnelDebugProvider();
        if (providerName === "") {
            // If no provider is configured in the settings, take the first one that's registered
            providerName = this.providers.map((p) => p.id).sort()[0];
        }
        const providerToUse: LocalTunnelDebugProvider | undefined = this.providers.find((p) => p.id === providerName);
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


