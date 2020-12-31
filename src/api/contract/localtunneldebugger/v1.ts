// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/localtunneldebugger/v1.ts
// at all times.

export interface LocalTunnelDebuggerV1 {
    register(localRedirectionDebugger: LocalTunnelDebuggerV1.LocalTunnelDebugger): void;
    startLocalTunnelDebugProvider(target?: any): void;
}

export namespace LocalTunnelDebuggerV1 {
    export interface LocalTunnelDebugger {
        readonly id: string;
        startDebugging(target?: any): void;
    }
}