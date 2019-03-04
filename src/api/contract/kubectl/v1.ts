// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/kubectl/v1.ts
// at all times.

export interface KubectlV1 {
    invokeCommand(command: string): Promise<KubectlV1.ShellResult | undefined>;
}

export namespace KubectlV1 {
    export interface ShellResult {
        readonly code: number;
        readonly stdout: string;
        readonly stderr: string;
    }
}
