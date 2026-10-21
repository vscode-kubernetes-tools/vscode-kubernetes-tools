import { EventEmitter } from 'vscode';
import { KubectlV2 } from '../../contract/kubectl/v2';
import { Kubectl } from '../../../kubectl';
import { ProcessExecutionError, ProcessExecutionOptions } from '../../../process';

export function impl(kubectl: Kubectl): KubectlV2 {
    return new KubectlV2Impl(kubectl);
}

class KubectlV2Impl implements KubectlV2 {
    constructor(private readonly kubectl: Kubectl) {}

    invokeCommand(args: ReadonlyArray<string>, options: KubectlV2.CommandOptions = {}): Promise<KubectlV2.CommandResult> {
        return this.execute(args, options, {});
    }

    observeCommand(args: ReadonlyArray<string>, options: KubectlV2.CommandOptions = {}): KubectlV2.RunningCommand {
        const stdout = new EventEmitter<string>();
        const stderr = new EventEmitter<string>();
        const controller = new AbortController();
        const result = this.execute(args, options, {
            captureOutput: false,
            onStdout: (chunk) => stdout.fire(chunk),
            onStderr: (chunk) => stderr.fire(chunk),
        }, controller).then((completion): KubectlV2.Completion => {
            stdout.dispose();
            stderr.dispose();
            // Streaming output is delivered only through events, not retained.
            const { stdout: _stdout, stderr: _stderr, ...status } = completion;
            return status;
        });
        return { onStdout: stdout.event, onStderr: stderr.event, result, dispose: () => controller.abort() };
    }

    private async execute(args: ReadonlyArray<string>, options: KubectlV2.CommandOptions, executionOptions: ProcessExecutionOptions, controller = new AbortController()): Promise<KubectlV2.CommandResult> {
        const commandArgs = Array.isArray(args) ? [...args] : undefined;
        if (!commandArgs || commandArgs.some((arg) => typeof arg !== 'string' || arg.includes('\0')) ||
            options === null || typeof options !== 'object' ||
            (options.stdin !== undefined && typeof options.stdin !== 'string') ||
            (executionOptions.captureOutput !== false && options.maxBufferBytes !== undefined &&
                (!Number.isSafeInteger(options.maxBufferBytes) || options.maxBufferBytes <= 0))) {
            return { status: 'failed', reason: 'invalid-argument', message: 'Expected literal string arguments without NUL, string stdin, and a positive integer output limit.', stdout: '', stderr: '' };
        }
        const cancel = () => controller.abort();
        const cancellation = options.cancellationToken?.onCancellationRequested(cancel);
        try {
            if (options.cancellationToken?.isCancellationRequested || controller.signal.aborted) {
                return { status: 'cancelled', stdout: '', stderr: '' };
            }
            const result = await this.kubectl.executeCommandArgs(commandArgs, options.stdin, {
                ...executionOptions,
                signal: controller.signal,
                maxBufferBytes: options.maxBufferBytes,
            });
            return { status: 'exited', code: result.code, signal: result.signal ?? null, stdout: result.stdout, stderr: result.stderr };
        } catch (error) {
            if (error instanceof ProcessExecutionError) {
                if (error.reason === 'cancelled') {
                    return { status: 'cancelled', stdout: error.stdout, stderr: error.stderr };
                }
                return { status: 'failed', reason: error.reason, message: error.message, errorCode: error.errorCode, stdout: error.stdout, stderr: error.stderr };
            }
            const failure = error as NodeJS.ErrnoException;
            return {
                status: 'failed', reason: 'execution-failed', message: error instanceof Error ? error.message : String(error),
                errorCode: failure?.code, stdout: '', stderr: '',
            };
        } finally {
            cancellation?.dispose();
        }
    }
}
