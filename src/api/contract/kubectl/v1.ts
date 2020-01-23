// This module is contractual and should not be changed after release.
// It should be in sync with vscode-kubernetes-tools-api/ts/kubectl/v1.ts
// at all times.

import * as vscode from 'vscode';

export interface KubectlV1 {
    invokeCommand(command: string): Promise<KubectlV1.ShellResult | undefined>;
    portForward(podName: string, podNamespace: string | undefined, localPort: number, remotePort: number, options?: KubectlV1.PortForwardOptions): Promise<vscode.Disposable | undefined>;
    getKubeconfigPath(): string;
}

export namespace KubectlV1 {
    export interface ShellResult {
        readonly code: number;
        readonly stdout: string;
        readonly stderr: string;
    }

    export interface PortForwardOptions {
        readonly showInUI?: PortForwardUIOptions;
    }

    export interface PortForwardNoUIOptions {
        readonly location: 'none';
    }

    export interface PortForwardStatusBarUIOptions {
        readonly location: 'status-bar';
        readonly description?: string;
        readonly onCancel?: () => void;
    }

    export type PortForwardUIOptions = PortForwardNoUIOptions | PortForwardStatusBarUIOptions;
}
