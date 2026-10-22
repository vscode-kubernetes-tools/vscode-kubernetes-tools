import { KubectlV2 } from '../../contract/kubectl/v2';
import { Kubectl } from '../../../kubectl';
import { ProcessExecutionError, ProcessExecutionOptions } from '../../../process';
import { PortForwardStatusBarManager } from '../../../components/kubectl/port-forward-ui';

export function impl(kubectl: Kubectl, portForwardStatusBarManager: PortForwardStatusBarManager): KubectlV2 {
    return new KubectlV2Impl(kubectl, portForwardStatusBarManager);
}

class KubectlV2Impl implements KubectlV2 {
    constructor(private readonly kubectl: Kubectl, private readonly portForwardStatusBarManager: PortForwardStatusBarManager) {}

    invokeCommand(args: ReadonlyArray<string>, options: KubectlV2.CommandOptions = {}): Promise<KubectlV2.CommandResult> {
        return this.execute(args, options, {});
    }

    observeCommand(args: ReadonlyArray<string>, options: KubectlV2.StreamingOptions = {}): KubectlV2.RunningCommand {
        const controller = new AbortController();
        const result = this.execute(args, options, {
            captureOutput: false,
            onStdout: options?.onStdout,
            onStderr: options?.onStderr,
        }, controller).then((completion): KubectlV2.Completion => {
            // Streaming output is delivered only through callbacks, not retained.
            const { stdout: _stdout, stderr: _stderr, ...status } = completion;
            return status;
        });
        return { result, dispose: () => controller.abort() };
    }

    async portForward(podName: string, podNamespace: string | undefined, localPort: number, remotePort: number, options: KubectlV2.PortForwardOptions = {}): Promise<KubectlV2.PortForwardResult> {
        if (typeof podName !== 'string' || !podName || podName.includes('\0') ||
            (podNamespace !== undefined && (typeof podNamespace !== 'string' || podNamespace.includes('\0'))) ||
            ![localPort, remotePort].every((port) => Number.isInteger(port) && port > 0 && port <= 65535) ||
            options === null || typeof options !== 'object' ||
            (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0))) {
            return { status: 'failed', reason: 'invalid-argument', message: 'Expected a pod name, namespace, ports from 1 to 65535, and a positive readiness timeout.' };
        }
        const args = ['port-forward', `pod/${podName}`, `${localPort}:${remotePort}`];
        if (podNamespace) {
            args.push('--namespace', podNamespace);
        }
        let ready!: () => void;
        const readiness = new Promise<void>((resolve) => { ready = resolve; });
        const pending = { stdout: '', stderr: '' };
        const inspect = (stream: 'stdout' | 'stderr', chunk: string) => {
            const text = pending[stream] + chunk;
            if (/Forwarding\s+from\s+(?:127\.0\.0\.1|\[::1\]):\d+\s+->\s+\d+/.test(text)) {
                ready();
            }
            pending[stream] = text.slice(-1024);
        };
        const command = this.observeCommand(args, {
            cancellationToken: options.cancellationToken,
            onStdout: (chunk) => inspect('stdout', chunk),
            onStderr: (chunk) => inspect('stderr', chunk),
        });
        let timer: NodeJS.Timeout | undefined;
        const timeout = new Promise<'timeout'>((resolve) => {
            timer = setTimeout(() => resolve('timeout'), options.timeoutMs ?? 10000);
        });
        const startup = await Promise.race([readiness.then(() => 'ready' as const), command.result, timeout]);
        clearTimeout(timer);
        if (startup === 'timeout') {
            const cancelled = options.cancellationToken?.isCancellationRequested;
            command.dispose();
            await command.result;
            if (cancelled) {
                return { status: 'cancelled' };
            }
            return { status: 'failed', reason: 'execution-failed', message: 'Timed out waiting for port forwarding to become ready.' };
        }
        if (startup !== 'ready') {
            return startup;
        }
        if (options.cancellationToken?.isCancellationRequested) {
            command.dispose();
            return command.result;
        }
        if (options.showInUI?.location === 'status-bar') {
            try {
                const cookie = this.portForwardStatusBarManager.registerPortForward({
                    podName, podNamespace, localPort, remotePort, terminator: command,
                    description: options.showInUI.description, onCancel: options.showInUI.onCancel,
                });
                void command.result.then(() => this.portForwardStatusBarManager.unregisterPortForward(cookie));
            } catch (error) {
                command.dispose();
                await command.result;
                return { status: 'failed', reason: 'execution-failed', message: error instanceof Error ? error.message : String(error) };
            }
        }
        return { status: 'ready', session: command };
    }

    private async execute(args: ReadonlyArray<string>, options: KubectlV2.CommandOptions, executionOptions: ProcessExecutionOptions, controller = new AbortController()): Promise<KubectlV2.CommandResult> {
        const commandArgs = Array.isArray(args) ? [...args] : undefined;
        if (!commandArgs || commandArgs.some((arg) => typeof arg !== 'string' || arg.includes('\0')) ||
            options === null || typeof options !== 'object' ||
            (options.stdin !== undefined && typeof options.stdin !== 'string') ||
            (executionOptions.onStdout !== undefined && typeof executionOptions.onStdout !== 'function') ||
            (executionOptions.onStderr !== undefined && typeof executionOptions.onStderr !== 'function') ||
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
