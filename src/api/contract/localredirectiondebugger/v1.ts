// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/localredirectiondebugger/v1.ts
// at all times.

export interface LocalRedirectionDebuggerV1 {
    register(localRedirectionDebugger: LocalRedirectionDebuggerV1.LocalRedirectionDebugger): void;
}

export namespace LocalRedirectionDebuggerV1 {
    export interface LocalRedirectionDebugger {
        readonly id: string;
        startDebugging(target?: any): void;
    }
}