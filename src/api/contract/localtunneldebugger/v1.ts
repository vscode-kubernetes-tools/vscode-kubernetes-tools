// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/localtunneldebugger/v1.ts
// at all times.

export interface LocalTunnelDebuggerV1 {
    registerLocalTunnelDebugProvider(localTunnelDebugProvider: LocalTunnelDebuggerV1.LocalTunnelDebugProvider): void;
}

export namespace LocalTunnelDebuggerV1 {
    export interface LocalTunnelDebugProvider {
        readonly id: string;
        startLocalTunnelDebugging(target?: any): void;
    }
}