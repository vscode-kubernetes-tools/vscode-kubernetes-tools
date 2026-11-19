import * as vscode from 'vscode';
import { CLUSTER_CONNECTION_SETTING, isOnDemandClusterConnection } from '../config/config';

// Tracks whether background cluster access is allowed.
export class ClusterAccessGate {
    private readonly onDidAllowEmitter = new vscode.EventEmitter<void>();
    private readonly onDidBlockEmitter = new vscode.EventEmitter<void>();
    private usedExplicitly = false;
    private allowed: boolean;
    private accessGeneration = 0;

    // Fires when access goes from blocked to allowed.
    readonly onDidAllow = this.onDidAllowEmitter.event;
    readonly onDidBlock = this.onDidBlockEmitter.event;

    constructor(private readonly isOnDemand: () => boolean) {
        this.allowed = this.isAllowed();
    }

    isAllowed(): boolean {
        return this.usedExplicitly || !this.isOnDemand();
    }

    captureAccess(): () => boolean {
        const generation = this.accessGeneration;
        const allowed = this.isAllowed();
        return () => allowed && generation === this.accessGeneration && this.isAllowed();
    }

    // Allows background cluster work for the current on-demand session.
    noteExplicitUse(): void {
        if (this.isOnDemand() && !this.usedExplicitly) {
            this.usedExplicitly = true;
            this.update();
        }
    }

    onConfigurationChanged(change: vscode.ConfigurationChangeEvent): void {
        if (change.affectsConfiguration(CLUSTER_CONNECTION_SETTING)) {
            if (!this.isOnDemand()) {
                this.usedExplicitly = false;
            }
            this.update();
        }
    }

    private update(): void {
        const wasAllowed = this.allowed;
        this.allowed = this.isAllowed();
        if (wasAllowed && !this.allowed) {
            this.accessGeneration++;
            this.onDidBlockEmitter.fire();
        }
        if (this.allowed && !wasAllowed) {
            this.onDidAllowEmitter.fire();
        }
    }
}

export const clusterAccess = new ClusterAccessGate(isOnDemandClusterConnection);

export function initialiseClusterAccess(context: vscode.ExtensionContext): void {
    vscode.workspace.onDidChangeConfiguration(clusterAccess.onConfigurationChanged, clusterAccess, context.subscriptions);
}

// Refresh commands, which other extensions also trigger programmatically.
const NON_EXPLICIT_COMMANDS = new Set([
    'extension.vsKubernetesRefreshExplorer',
    'extension.vsKubernetesRefreshCloudExplorer',
    'extension.vsKubernetesRefreshHelmRepoExplorer',
]);

// Returns true for Kubernetes commands run by the user.
export function isKubernetesCommand(command: string): boolean {
    return command.startsWith('extension.vsKubernetes') && !NON_EXPLICIT_COMMANDS.has(command);
}
