// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/kubectl/v1.ts
// at all times.

import * as vscode from 'vscode';

export interface KubectlV1 {
    invokeCommand(command: string): Promise<KubectlV1.ShellResult | undefined>;
    portForward(podName: string, podNamespace: string | undefined, localPort: number, remotePort: number): Promise<vscode.Disposable | undefined>;
}

export namespace KubectlV1 {
    export interface ShellResult {
        readonly code: number;
        readonly stdout: string;
        readonly stderr: string;
    }
}
