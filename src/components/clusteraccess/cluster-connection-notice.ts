import * as vscode from 'vscode';
import { Kubectl } from '../../kubectl';
import { currentContextUsesCredentialPlugin } from '../../kubectlUtils';
import { CLUSTER_CONNECTION_SETTING, isClusterConnectionConfigured, setOnDemandClusterConnection } from '../config/config';

export const NOTICE_CHECKED_KEY = 'vscode-kubernetes.clusterConnectionNoticeChecked';
export const SWITCH_ACTION = 'Use On-Demand';
export const OPEN_SETTING_ACTION = 'Open Setting';

// Shows a one-time notice if the current context uses a credential plugin.
export async function showClusterConnectionNotice(context: vscode.ExtensionContext, kubectl: Kubectl): Promise<void> {
    context.globalState.setKeysForSync([NOTICE_CHECKED_KEY]);
    if (context.globalState.get<boolean>(NOTICE_CHECKED_KEY) || isClusterConnectionConfigured()) {
        return;
    }

    const usesCredentialPlugin = await currentContextUsesCredentialPlugin(kubectl);
    if (usesCredentialPlugin === undefined) {
        return;
    }
    await context.globalState.update(NOTICE_CHECKED_KEY, true);
    if (!usesCredentialPlugin) {
        return;
    }

    const choice = await vscode.window.showInformationMessage(
        'Your current cluster signs in with a credential plugin. Kubernetes Tools connects to it in the background, which can start a sign-in. Switch to on-demand to connect only when you use the extension.',
        SWITCH_ACTION,
        OPEN_SETTING_ACTION);
    if (choice === SWITCH_ACTION) {
        await setOnDemandClusterConnection();
    } else if (choice === OPEN_SETTING_ACTION) {
        await vscode.commands.executeCommand('workbench.action.openSettings', CLUSTER_CONNECTION_SETTING);
    }
}
