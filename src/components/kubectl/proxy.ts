import * as vscode from 'vscode';
import { Errorable } from '../../errorable';
import { ExecResult } from '../../binutilplusplus';
import { Kubectl } from '../../kubectl';
import { StringDecoder } from 'string_decoder';

export interface ProxySession {
    readonly port: number;
    dispose(): void;
}

const sessions = new Set<AbortController>();

export function disposeProxySessions(): void {
    for (const session of sessions) { session.abort(); }
}

export function initialiseProxyLifecycle(
    context: vscode.ExtensionContext,
    onContextChanged: vscode.Event<unknown>,
    onKubeconfigChanged: vscode.Event<unknown>
): void {
    onContextChanged(disposeProxySessions, undefined, context.subscriptions);
    onKubeconfigChanged(disposeProxySessions, undefined, context.subscriptions);
    vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('vs-kubernetes') || event.affectsConfiguration('vscode-kubernetes')) {
            disposeProxySessions();
        }
    }, undefined, context.subscriptions);
    context.subscriptions.push({ dispose: disposeProxySessions });
}

export async function proxy(kubectl: Kubectl, port: number | 'random', signal?: AbortSignal): Promise<Errorable<ProxySession>> {
    if (port !== 'random' && (!Number.isInteger(port) || port < 1 || port > 65535)) {
        return { succeeded: false, error: ['Invalid Kubernetes proxy port.'] };
    }
    return startForwardingProcess(kubectl, ['proxy', '--address=127.0.0.1', `--port=${port === 'random' ? 0 : port}`],
        /(?:^|\n)Starting to serve on 127\.0\.0\.1:(\d+)\r?\n/, signal);
}

// A session owns pending startup as well as its direct child.
export async function startForwardingProcess(
    kubectl: Kubectl, args: readonly string[], readiness: RegExp, signal?: AbortSignal, startupTimeout = 30000
): Promise<Errorable<ProxySession>> {
    const cancellation = new AbortController();
    const abort = () => cancellation.abort();
    if (signal?.aborted) { abort(); }
    signal?.addEventListener('abort', abort, { once: true });
    sessions.add(cancellation);
    const release = () => {
        sessions.delete(cancellation);
        signal?.removeEventListener('abort', abort);
    };
    if (cancellation.signal.aborted) {
        release();
        return { succeeded: false, error: ['Kubernetes forwarding cancelled.'] };
    }
    const result = await kubectl.spawnCommandArgs(args).catch((error) => ({
        resultKind: 'exec-failed' as const, execProgram: { binBaseName: 'kubectl', displayName: 'Kubectl', configKeyName: 'kubectl', offersInstall: true },
        command: '', error: String(error),
    }));
    if (result.resultKind !== 'exec-child-process-started') {
        release();
        return { succeeded: false, error: [cancellation.signal.aborted ? 'Kubernetes forwarding cancelled.' : ExecResult.failureMessage(result, {})] };
    }
    const child = result.childProcess;
    return new Promise<Errorable<ProxySession>>((resolve) => {
        let settled = false;
        let closed = false;
        let killTimer: NodeJS.Timeout | undefined;
        let output = '';
        let stderr = '';
        const decoder = new StringDecoder('utf8');
        const finish = (value: Errorable<ProxySession>) => {
            if (settled) { return; }
            settled = true;
            clearTimeout(startupTimer);
            resolve(value);
        };
        const stop = () => {
            if (!closed && !killTimer) {
                killTimer = setTimeout(() => {
                    if (child.exitCode === null && child.signalCode === null && child.pid && child.pid > 0) { child.kill('SIGKILL'); }
                    child.stdin?.destroy(); child.stdout?.destroy(); child.stderr?.destroy();
                }, 2000);
                killTimer.unref();
                if (child.exitCode === null && child.signalCode === null && child.pid && child.pid > 0) { child.kill(); }
            }
            finish({ succeeded: false, error: ['Kubernetes forwarding cancelled.'] });
        };
        const fail = (message: string) => {
            finish({ succeeded: false, error: [message] });
            cancellation.abort();
        };
        const startupTimer = setTimeout(() => fail('Timed out starting Kubernetes forwarding.'), startupTimeout);
        startupTimer.unref();
        cancellation.signal.addEventListener('abort', stop, { once: true });
        child.stdin?.end();
        child.stdout?.on('data', (chunk: Buffer) => {
            if (settled || cancellation.signal.aborted) { return; }
            output += decoder.write(chunk);
            const match = readiness.exec(output);
            if (match) {
                const actualPort = Number(match[1]);
                if (!Number.isInteger(actualPort) || actualPort < 1 || actualPort > 65535) {
                    fail('Kubernetes forwarding returned an invalid port.');
                    return;
                }
                finish({ succeeded: true, result: {
                    port: actualPort,
                    dispose: abort,
                } });
            }
            output = output.slice(-8192);
        });
        child.stderr?.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(-8192); });
        child.once('error', (error) => fail(`Failed to start Kubernetes forwarding: ${error.message}`));
        const onClose = () => {
            closed = true;
            if (killTimer) { clearTimeout(killTimer); }
            clearTimeout(startupTimer);
            cancellation.signal.removeEventListener('abort', stop);
            finish({ succeeded: false, error: [stderr || 'Kubernetes forwarding exited before readiness.'] });
            release();
        };
        child.once('close', onClose);
        if (cancellation.signal.aborted) { stop(); }
        if (child.exitCode !== null || child.signalCode !== null) { onClose(); }
    });
}
