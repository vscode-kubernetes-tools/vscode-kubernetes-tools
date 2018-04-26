import { WorkspaceFolder, DebugConfiguration, CancellationToken, ProviderResult, DebugConfigurationProvider } from "vscode";
import * as Net from 'net';
import { DraftDebugSession } from "./debugDebug";

export class DraftConfigurationProvider implements DebugConfigurationProvider {
    private _server?: Net.Server;

    constructor() {
    }

    resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
        if (!this._server) {
            this._server = Net.createServer((socket) => {
                const session = new DraftDebugSession();
                session.config = config;
                session.setRunAsServer(true);
                session.start(<NodeJS.ReadableStream>socket, socket);
            }).listen(0);
        }
        config.debugServer = this._server.address().port;

        return config;
    }

    dispose() {
        if (this._server) {
            this._server.close();
        }
    }
}