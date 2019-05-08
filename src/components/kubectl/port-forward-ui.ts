import * as vscode from 'vscode';

import { Dictionary } from "../../utils/dictionary";

export interface PortForwardSession {
    readonly podName: string;
    readonly podNamespace: string | undefined;
    readonly localPort: number;
    readonly remotePort: number;
    readonly description: string | undefined;
    readonly onCancel?: () => void;
}

export class PortForwardStatusBarManager {
    private readonly sessions = Dictionary.of<PortForwardSession>();
    private constructor(private readonly statusBarItem: vscode.StatusBarItem) {}

    static init(statusBarItem: vscode.StatusBarItem): PortForwardStatusBarManager {
        const manager = new PortForwardStatusBarManager(statusBarItem);
        manager.refreshPortForwardStatus();
        return manager;
    }

    registerPortForward(session: PortForwardSession): string {
        const lookupKey = keyOf(session);
        this.sessions[lookupKey] = session;
        this.refreshPortForwardStatus();
        return lookupKey;
    }

    unregisterPortForward(cookie: string): void {
        const session = this.sessions[cookie];
        if (session.onCancel) {
            session.onCancel();
        }
        delete this.sessions[cookie];
        this.refreshPortForwardStatus();
    }

    private refreshPortForwardStatus() {
        const sessionCount = Object.keys(this.sessions).length;
        if (sessionCount > 0) {
            this.statusBarItem.text = 'Kubectl Port Forwarding';
            this.statusBarItem.tooltip = `kubectl is currently running ${sessionCount} port forwarding sessions in the background.  Click to view and terminate.`;
            this.statusBarItem.command = 'kubernetes.portForwarding.showSessions';
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }
}

function keyOf(session: PortForwardSession): string {
    return `PFSESSIONKEY/${session.podName}/${session.podNamespace || ''}/${session.localPort}`;
}
