import { randomUUID } from 'crypto';
import * as vscode from 'vscode';

export function registerDebugSessionCleanup(configuration: vscode.DebugConfiguration, onTerminate: () => void): () => void {
    const launchId = randomUUID();
    configuration.kubernetesLaunchId = launchId;
    let cleaned = false;
    const cleanup = () => {
        if (cleaned) { return; }
        cleaned = true;
        listener.dispose();
        onTerminate();
    };
    const listener = vscode.debug.onDidTerminateDebugSession((session) => {
        if (session.configuration.kubernetesLaunchId === launchId) { cleanup(); }
    });
    return cleanup;
}
