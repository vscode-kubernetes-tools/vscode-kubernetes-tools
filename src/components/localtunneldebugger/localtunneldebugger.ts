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
        const providerName: string | undefined = getLocalTunnelDebugProvider() ?? this.providers.map((p) => p.id).sort()[0];
        const providerToUse: LocalTunnelDebugProvider | undefined = this.providers.find((p) => p.id === providerName);

        if (this.providers.length === 0) {
            const message = 'You do not have a Local Tunnel Debug Provider installed.';
            LocalTunnelDebugger.displayUIandExecuteCommand(message);
        }

        if (providerToUse === undefined) {
            const message = `You have configured VSCode to use Local Tunnel debugger '${providerName}', but it is not installed.`;
            LocalTunnelDebugger.displayUIandExecuteCommand(message);
        } else {
            providerToUse.startDebugging(target);
        }
    };

    static displayUIandExecuteCommand(message: string) {
        const browseExtensions = "Find Providers on Marketplace";

        vscode.window.showInformationMessage(message, browseExtensions)
            .then((selection: string | undefined) => {
                if (selection === browseExtensions) {
                    vscode.commands.executeCommand('extension.vsKubernetesFindLocalTunnelDebugProviders');
                }
            });
    }
}


