// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/helm/v1.ts
// at all times.

export interface HelmV1 {
    invokeCommand(command: string): Promise<HelmV1.ShellResult | undefined>;
}

export namespace HelmV1 {
    export interface ShellResult {
        readonly code: number;
        readonly stdout: string;
        readonly stderr: string;
    }
}
