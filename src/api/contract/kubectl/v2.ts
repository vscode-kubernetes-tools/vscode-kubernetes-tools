// Keep in sync with vscode-kubernetes-tools-api/ts/kubectl/v2.ts.

import * as vscode from 'vscode';

/** Runs kubectl with literal arguments, never through a local shell. */
export interface KubectlV2 {
    /** Buffers stdout and stderr, with a 20 MiB limit per stream by default. */
    invokeCommand(args: ReadonlyArray<string>, options?: KubectlV2.CommandOptions): Promise<KubectlV2.CommandResult>;
    /** Streams UTF-8 chunks without buffering. Subscribe immediately after calling. */
    observeCommand(args: ReadonlyArray<string>, options?: KubectlV2.CommandOptions): KubectlV2.RunningCommand;
}

export namespace KubectlV2 {
    export interface CommandOptions {
        readonly stdin?: string;
        readonly cancellationToken?: vscode.CancellationToken;
        /** Positive byte limit per stream for invokeCommand; ignored by observeCommand. */
        readonly maxBufferBytes?: number;
    }

    export interface Exited {
        readonly status: 'exited';
        /** Nonzero exits are normal results, not invocation failures. */
        readonly code: number;
        /** A signal-terminated process has code -1 and a non-null signal. */
        readonly signal: string | null;
    }

    export interface Cancelled {
        readonly status: 'cancelled';
    }

    export interface Failed {
        readonly status: 'failed';
        readonly reason: 'invalid-argument' | 'invalid-executable' | 'spawn-failed' | 'output-limit' | 'execution-failed';
        readonly message: string;
        /** OS error code, such as ENOENT, when available. */
        readonly errorCode?: string;
    }

    export type Completion = Exited | Cancelled | Failed;
    /** Includes partial output on cancellation or failure. Output is not trimmed. */
    export type CommandResult = Completion & { readonly stdout: string; readonly stderr: string };

    export interface RunningCommand extends vscode.Disposable {
        readonly onStdout: vscode.Event<string>;
        readonly onStderr: vscode.Event<string>;
        /** Resolves on exit or failure, after the process and its streams close. */
        readonly result: Promise<Completion>;
        /** Cancels the command. Repeated calls are harmless. */
        dispose(): void;
    }
}
