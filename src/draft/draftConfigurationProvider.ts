import { WorkspaceFolder, DebugConfiguration, CancellationToken, ProviderResult, DebugConfigurationProvider } from "vscode";
import * as Net from 'net';
import { DraftDebugSession } from "./debugDebug";

export class DraftConfigurationProvider implements DebugConfigurationProvider {
    private server?: Net.Server;

    constructor() {
    }

    resolveDebugConfiguration(_folder: WorkspaceFolder | undefined, config: DebugConfiguration, _token?: CancellationToken): ProviderResult<DebugConfiguration> {
        if (!this.server) {
            this.server = Net.createServer((socket) => {
                const session = new DraftDebugSession();
                session.config = config;
                session.setRunAsServer(true);
                session.start(<NodeJS.ReadableStream>socket, socket);
            }).listen(0);
        }
        config.debugServer = extractPort(this.server.address());

        return config;
    }

    dispose() {
        if (this.server) {
            this.server.close();
        }
    }
}

function extractPort(address: string | Net.AddressInfo): number {
    return (address as Net.AddressInfo).port;  // always an AddressInfo unless listening on a pipe or Unix domain socket
}
