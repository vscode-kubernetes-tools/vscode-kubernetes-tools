import type { ChildProcess } from 'child_process';
import type { CancellationToken } from 'vscode';
import { kubeChannel } from '../kubeChannel';

export function waitForPortForward(process: ChildProcess, mappings: readonly string[], token?: CancellationToken): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let pending = '';
        let pendingError = '';
        const remaining = new Set(mappings);
        let ready = false;
        let settled = false;
        const finish = (error?: Error) => {
            if (settled) {
                return;
            }
            settled = true;
            process.stdout?.removeListener('data', onOutput);
            process.stdout?.resume();
            if (error) {
                if (process.exitCode === null && process.signalCode === null) {
                    process.kill();
                }
                reject(error);
            } else {
                ready = true;
                resolve();
            }
        };
        const onOutput = (chunk: Buffer | string) => {
            const output = pending + chunk.toString();
            const lines = output.split('\n');
            pending = lines.pop()!.slice(-4096);
            for (const line of lines) {
                const match = /^Forwarding from (?:127\.0\.0\.1|\[::1\]):(\d+) -> (\d+)\r?$/.exec(line);
                if (match) {
                    remaining.delete(`${match[1]}:${match[2]}`);
                    if (remaining.size === 0) { finish(); }
                }
            }
        };
        const onError = (error: Error) => {
            if (ready) {
                kubeChannel.showOutput(error.message, 'port-forward');
            } else {
                finish(error);
            }
        };
        const onStderr = (chunk: Buffer | string) => {
            kubeChannel.showOutput(chunk.toString(), 'port-forward');
            const text = pendingError + chunk.toString();
            const match = /Unable to listen on port (\d+)/.exec(text);
            if (!ready && match && mappings.some((mapping) => mapping.split(':')[0] === match[1])) {
                finish(new Error(`Cannot set up port forwarding: unable to listen on port ${match[1]}.`));
            }
            pendingError = text.slice(-4096);
        };
        const cancel = () => {
            if (ready) {
                process.kill();
            } else {
                finish(new Error('Port forwarding cancelled.'));
            }
        };
        const cancellation = token?.onCancellationRequested(cancel);
        const cleanup = () => {
            cancellation?.dispose();
            process.stderr?.removeListener('data', onStderr);
            process.removeListener('error', onError);
            process.removeListener('close', onClose);
        };
        const onClose = () => {
            cleanup();
            if (!ready) {
                finish(new Error('Cannot set up port forwarding: kubectl exited before becoming ready.'));
            }
        };
        process.stdout?.on('data', onOutput);
        process.stderr?.on('data', onStderr);
        process.on('error', onError);
        process.once('close', onClose);
        if (process.exitCode !== null || process.signalCode !== null) {
            finish(new Error(token?.isCancellationRequested ? 'Port forwarding cancelled.' : 'Cannot set up port forwarding: kubectl has already exited.'));
            cleanup();
        } else if (token?.isCancellationRequested) {
            cancel();
        }
    });
}
