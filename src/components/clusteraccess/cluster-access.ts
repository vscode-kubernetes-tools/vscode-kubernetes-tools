import * as vscode from 'vscode';
import { CLUSTER_CONNECTION_SETTING, isOnDemandClusterConnection } from '../config/config';

// Tracks whether background cluster access is allowed.
export class ClusterAccessGate {
    private readonly onDidAllowEmitter = new vscode.EventEmitter<void>();
    private usedExplicitly = false;
    private allowed: boolean;

    // Fires when access goes from blocked to allowed.
    readonly onDidAllow = this.onDidAllowEmitter.event;

    constructor(private readonly isOnDemand: () => boolean) {
        this.allowed = this.isAllowed();
    }

    isAllowed(): boolean {
        return this.usedExplicitly || !this.isOnDemand();
    }

    // Allows background cluster work until the window reloads. No effect in automatic mode.
    noteExplicitUse(): void {
        if (!this.usedExplicitly) {
            this.usedExplicitly = true;
            this.update();
        }
    }

    onConfigurationChanged(change: vscode.ConfigurationChangeEvent): void {
        if (change.affectsConfiguration(CLUSTER_CONNECTION_SETTING)) {
            this.update();
        }
    }

    private update(): void {
        const wasAllowed = this.allowed;
        this.allowed = this.isAllowed();
        if (this.allowed && !wasAllowed) {
            this.onDidAllowEmitter.fire();
        }
    }
}

export const clusterAccess = new ClusterAccessGate(isOnDemandClusterConnection);

export function initialiseClusterAccess(context: vscode.ExtensionContext): void {
    vscode.workspace.onDidChangeConfiguration(clusterAccess.onConfigurationChanged, clusterAccess, context.subscriptions);
}

// Refresh commands, which also run programmatically.
const NON_EXPLICIT_COMMANDS = new Set([
    'extension.vsKubernetesRefreshExplorer',
    'extension.vsKubernetesRefreshCloudExplorer',
    'extension.vsKubernetesRefreshHelmRepoExplorer',
]);

export function isKubernetesCommand(command: string): boolean {
    return command.startsWith('extension.vsKubernetes') && !NON_EXPLICIT_COMMANDS.has(command);
}

// Once the operation finishes, allows the background YAML schema fetch and extension recommender to run. Returns the result unchanged.
export function noteExplicitUseWhenSettled<T>(result: T, gate: ClusterAccessGate = clusterAccess): T {
    const note = () => gate.noteExplicitUse();
    Promise.resolve(result).then(note, note);
    return result;
}
